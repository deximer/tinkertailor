#!/usr/bin/env bash
set -euo pipefail

# Install the act_runner systemd user service so it survives reboots.
# Run this on the ARM64 build host as the user that owns ~/act_runner.
#
# Usage: ./infra/setup-runner.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_FILE="$SCRIPT_DIR/act-runner.service"

if [[ ! -f "$SERVICE_FILE" ]]; then
  echo "Error: Service file not found: $SERVICE_FILE" >&2
  exit 1
fi

if [[ ! -f "$HOME/act_runner" ]]; then
  echo "Error: act_runner binary not found at ~/act_runner" >&2
  echo "Download from https://gitea.com/gitea/act_runner/releases" >&2
  exit 1
fi

if [[ ! -f "$HOME/.config/act_runner.yaml" ]]; then
  echo "Error: act_runner config not found at ~/.config/act_runner.yaml" >&2
  exit 1
fi

# Create user systemd directory
mkdir -p "$HOME/.config/systemd/user"

# Install service file
cp "$SERVICE_FILE" "$HOME/.config/systemd/user/act-runner.service"

# Reload systemd, enable and start
systemctl --user daemon-reload
systemctl --user enable act-runner.service
systemctl --user start act-runner.service

# Enable lingering so user services run without an active login session
loginctl enable-linger "$(whoami)"

echo "==> act_runner service installed and started."
echo "    Status: systemctl --user status act-runner"
echo "    Logs:   journalctl --user -u act-runner -f"
