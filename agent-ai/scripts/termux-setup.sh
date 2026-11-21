#!/data/data/com.termux/files/usr/bin/bash
# One-time setup for running agent-ai on Android in Termux.
set -euo pipefail

say() { echo "\n>>> $*"; }

say "Updating Termux packages"
pkg update -y

say "Installing nodejs and git"
pkg install -y nodejs git

say "Checking for Termux:API (optional, enables notifications/text-to-speech)"
if command -v termux-api >/dev/null 2>&1; then
  echo "termux-api already installed"
else
  say "To enable phone tools, run:"
  echo "  pkg install termux-api"
  echo "and install the 'Termux:API' add-on app from F-Droid or GitHub Releases."
fi

AGENT_DIR="$HOME/agent-ai"
if [ -d "$AGENT_DIR/.git" ]; then
  say "Updating existing copy in $AGENT_DIR"
  git -C "$AGENT_DIR" pull --ff-only || true
elif [ -f "$AGENT_DIR/index.js" ]; then
  say "Found agent-ai in $AGENT_DIR (no git history), leaving it in place"
else
  say "Cloning agent-ai into $AGENT_DIR"
  # Replace with your own repository URL once pushed to GitHub.
  git clone https://github.com/altraaa1995-eng/pepper-vpn-client.git "$AGENT_DIR"
fi

cd "$AGENT_DIR"

if [ ! -f .env ]; then
  say "Creating .env"
  printf 'MISTRAL_API_KEY=' > .env
  read -r -p "Paste your Mistral API key: " key
  printf '%s\n' "$key" >> .env
  chmod 600 .env
fi

say "Smoke test (no API call)"
node index.js --help >/dev/null && echo "OK: agent-ai is ready"

say "Run the agent on a project with:"
echo "  cd ~/agent-ai"
echo "  node index.js --root ~/my-project \"add tests to my script\""
echo ""
say "Give it access to phone storage (optional) once, with:"
echo "  termux-setup-storage"
