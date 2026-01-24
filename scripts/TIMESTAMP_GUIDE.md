# Timestamp Format Guide

## How to Enter Timestamps

The identification feature accepts timestamps in these formats:

### Format 1: `MM:SS` (Minutes:Seconds)
- **Example**: `15:30` = 15 minutes and 30 seconds
- **Example**: `75:00` = 75 minutes (1 hour 15 minutes)

### Format 2: `HH:MM:SS` (Hours:Minutes:Seconds)
- **Example**: `1:15:00` = 1 hour, 15 minutes, 0 seconds
- **Example**: `0:23:45` = 23 minutes and 45 seconds
- **Example**: `2:30:15` = 2 hours, 30 minutes, 15 seconds

## For 1 Hour 15 Minutes

You can enter it as:
- **`1:15:00`** (recommended - HH:MM:SS format)
- **`75:00`** (MM:SS format - 75 minutes)

Both will work! The app converts them to seconds (4500 seconds = 1 hour 15 minutes).

## How It Works

1. You enter the timestamp in the format above
2. The app converts it to seconds
3. ACRCloud analyzes the audio starting at that timestamp
4. It listens for 15 seconds (default) from that point
5. Returns the identified track

## Example

If you want to identify the track at **1 hour 15 minutes**:
- Enter: `1:15:00` or `75:00`
- ACRCloud will analyze audio from 1:15:00 to 1:15:15 (15 second segment)
