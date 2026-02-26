#!/bin/bash
# Setup script for daily house set sync + morning report
# Run this once to install both scheduled tasks on macOS

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"

SYNC_PLIST_NAME="com.rork.daily-house-sync"
SYNC_PLIST_PATH="$HOME/Library/LaunchAgents/${SYNC_PLIST_NAME}.plist"

REPORT_PLIST_NAME="com.rork.daily-sync-report"
REPORT_PLIST_PATH="$HOME/Library/LaunchAgents/${REPORT_PLIST_NAME}.plist"

echo "=== Rork Daily House Sync + Report Setup ==="
echo ""
echo "Project directory: $PROJECT_DIR"
echo ""

# Create logs directory
mkdir -p "$LOG_DIR"

# Install Python dependencies if needed
echo "Checking Python dependencies..."
pip3 install beautifulsoup4 fake-headers requests supabase --quiet 2>/dev/null
cd "$PROJECT_DIR/1001-tracklists-api" && pip3 install -e . --quiet 2>/dev/null
echo "Dependencies installed."

# ---- 1. Sync task (7:00 AM) ----

cat > "$SYNC_PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${SYNC_PLIST_NAME}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>${SCRIPT_DIR}/daily_house_sync.py</string>
        <string>--limit</string>
        <string>15</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${PROJECT_DIR}</string>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>7</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>${LOG_DIR}/house_sync.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/house_sync_error.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
</dict>
</plist>
EOF

echo "Created sync plist: $SYNC_PLIST_PATH"
launchctl unload "$SYNC_PLIST_PATH" 2>/dev/null
launchctl load "$SYNC_PLIST_PATH"

# Clean up old separate report plist if it exists
launchctl unload "$REPORT_PLIST_PATH" 2>/dev/null
rm -f "$REPORT_PLIST_PATH"

echo ""
echo "=== Schedule activated! ==="
echo ""
echo "  7:00 AM  -  Sync top 15 house sets + generate report (all in one run)"
echo ""
echo "Useful commands:"
echo "  Run sync now:      python3 $SCRIPT_DIR/daily_house_sync.py"
echo "  Run report now:    python3 $SCRIPT_DIR/daily_sync_report.py"
echo "  Dry run sync:      python3 $SCRIPT_DIR/daily_house_sync.py --dry-run"
echo "  View sync logs:    tail -f $LOG_DIR/house_sync.log"
echo "  View reports:      ls $LOG_DIR/sync_report_*.txt"
echo "  Stop schedule:     launchctl unload $SYNC_PLIST_PATH"
echo ""
