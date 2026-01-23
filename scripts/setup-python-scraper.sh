#!/bin/bash
# Setup script to install the Python 1001tracklists scraper

echo "Setting up Python 1001tracklists scraper..."
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install it first."
    exit 1
fi

echo "✓ Python 3 found"

# Clone the library
LIB_DIR="1001-tracklists-api"
if [ ! -d "$LIB_DIR" ]; then
    echo "Cloning 1001-tracklists-api library..."
    git clone https://github.com/leandertolksdorf/1001-tracklists-api.git "$LIB_DIR"
    echo "✓ Library cloned"
else
    echo "✓ Library already exists"
fi

# Install dependencies
echo "Installing Python dependencies..."
cd "$LIB_DIR"
pip3 install -r requirements.txt
cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "Usage:"
echo "  python3 scripts/scrape_1001_python.py <url>"
echo ""
echo "Example:"
echo "  python3 scripts/scrape_1001_python.py 'https://www.1001tracklists.com/tracklist/14wrxfdt/...'"
