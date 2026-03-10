#!/bin/bash

# Configuration
API_URL="https://share.learningis1.st"
MAX_SIZE_BYTES=$((100 * 1024 * 1024)) # 100 MB limit matches worker config

if [ "$#" -lt 2 ]; then
    echo "Usage: $0 <local_path> <auth_token>"
    echo ""
    echo "Examples:"
    echo "  $0 /home/pi/my_backups my_secret_token"
    echo "  $0 /home/pi/document.pdf my_secret_token"
    exit 1
fi

LOCAL_PATH="${1%/}" # Strip trailing slash if present
AUTH_TOKEN="$2"

# Ensure local path exists
if [ ! -e "$LOCAL_PATH" ]; then
    echo "Error: Local path '$LOCAL_PATH' does not exist."
    exit 1
fi

# 1. Authenticate and get session token
echo "Authenticating..."
AUTH_RESP=$(curl -s -X POST "$API_URL/auth" \
    -H "Content-Type: application/json" \
    -d "{\"token\":\"$AUTH_TOKEN\"}")

# Extract sessionToken
if command -v jq >/dev/null 2>&1; then
    SESSION_TOKEN=$(echo "$AUTH_RESP" | jq -r '.sessionToken // empty')
else
    SESSION_TOKEN=$(echo "$AUTH_RESP" | grep -o '"sessionToken":"[^"]*' | cut -d'"' -f4)
fi

if [ -z "$SESSION_TOKEN" ]; then
    echo "Authentication failed. Server response: $AUTH_RESP"
    exit 1
fi

echo "Authentication successful!"

# --- Helper Function: Upload a single file ---
upload_file() {
    local file_path="$1"
    local remote_name="$2"
    local rel_path="$3"

    # Get File Size (Cross-platform compatibility for Linux/macOS)
    if [ "$(uname)" == "Darwin" ]; then
        FILE_SIZE=$(stat -f%z "$file_path")
    else
        FILE_SIZE=$(stat -c%s "$file_path")
    fi

    # Pre-upload check to match Worker's 100MB limit
    if [ "$FILE_SIZE" -gt "$MAX_SIZE_BYTES" ]; then
        echo "Skipping: $rel_path [Failed] (Payload Too Large: $((FILE_SIZE / 1024 / 1024))MB > 100MB)"
        return
    fi

    # URL-encode the remote name
    ENCODED_NAME=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))" "$remote_name")

    # Determine MIME type dynamically
    MIME_TYPE=$(file -b --mime-type "$file_path" 2>/dev/null || echo "application/octet-stream")

    echo -n "Uploading: $rel_path -> $remote_name "

    # Upload using curl with retries and MIME type handling
    UPLOAD_RESP=$(curl -s --retry 3 -w "\n%{http_code}" "$API_URL/upload?name=$ENCODED_NAME" \
        -H "Authorization: Bearer $SESSION_TOKEN" \
        -H "Content-Type: $MIME_TYPE" \
        -H "Expect:" \
        -T "$file_path")

    HTTP_CODE=$(echo "$UPLOAD_RESP" | tail -n1)
    BODY=$(echo "$UPLOAD_RESP" | sed '$d')

    if [ "$HTTP_CODE" -eq 200 ]; then
        echo "[Success]"
    elif [ "$HTTP_CODE" -eq 409 ]; then
        echo "[Skipped] (File already exists)"
    elif [ "$HTTP_CODE" -eq 413 ]; then
        echo "[Failed] (Payload Too Large - Exceeds worker limits)"
    elif [ "$HTTP_CODE" -eq 411 ]; then
        echo "[Failed] (Length Required - Chunked encoding rejected)"
    else
        echo "[Failed] (HTTP $HTTP_CODE: $BODY)"
    fi
}
# ---------------------------------------------


# 2. Determine if target is a file or directory
if [ -f "$LOCAL_PATH" ]; then
    
    # --- SINGLE FILE SYNC ---
    FILE_NAME="$(basename "$LOCAL_PATH")"
    echo "Syncing single file: '$FILE_NAME'..."
    
    upload_file "$LOCAL_PATH" "$FILE_NAME" "$FILE_NAME"

elif [ -d "$LOCAL_PATH" ]; then

    # --- DIRECTORY SYNC ---
    REMOTE_PREFIX="$(basename "$LOCAL_PATH")/"
    echo "Syncing to remote folder: '$REMOTE_PREFIX'..."

    # Replicate Empty Directories
    echo "Preparing folders..."
    find "$LOCAL_PATH" -type d -empty -print0 | while IFS= read -r -d '' DIR_PATH; do

        REL_PATH="${DIR_PATH#$LOCAL_PATH/}"
        # Skip the root directory itself if it is completely empty
        if [ "$DIR_PATH" == "$LOCAL_PATH" ]; then
            continue
        fi

        REMOTE_NAME="${REMOTE_PREFIX}${REL_PATH}/"
        ENCODED_NAME=$(python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1]))" "$REMOTE_NAME")

        echo -n "Creating empty folder: $REL_PATH/ -> $REMOTE_NAME "

        UPLOAD_RESP=$(curl -s --retry 3 -w "\n%{http_code}" -X PUT "$API_URL/upload?name=$ENCODED_NAME" \
            -H "Authorization: Bearer $SESSION_TOKEN" \
            -d "")

        HTTP_CODE=$(echo "$UPLOAD_RESP" | tail -n1)
        BODY=$(echo "$UPLOAD_RESP" | sed '$d')

        if [ "$HTTP_CODE" -eq 200 ]; then
            echo "[Success]"
        elif [ "$HTTP_CODE" -eq 409 ]; then
            echo "[Skipped] (Folder already exists)"
        else
            echo "[Failed] (HTTP $HTTP_CODE: $BODY)"
        fi
    done

    # Iterate through files
    echo "Uploading files..."
    find "$LOCAL_PATH" -type f -print0 | while IFS= read -r -d '' FILE_PATH; do
        REL_PATH="${FILE_PATH#$LOCAL_PATH/}"
        REMOTE_NAME="${REMOTE_PREFIX}${REL_PATH}"
        
        upload_file "$FILE_PATH" "$REMOTE_NAME" "$REL_PATH"
    done

fi

echo "Sync process complete."
