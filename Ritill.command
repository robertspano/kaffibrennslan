#!/bin/bash
# Tvísmelltu á þessa skrá til að opna ritilinn heima.
cd "$(dirname "$0")" || exit 1
( sleep 1; open "http://localhost:8080/index.html?edit=1" ) &
echo "────────────────────────────────────────────"
echo "   Kaffibrennslan — ritill"
echo ""
echo "   Vafrinn opnast eftir augnablik."
echo "   Smelltu á texta eða mynd til að breyta,"
echo "   svo á 'Vista & birta'."
echo ""
echo "   Lokaðu þessum glugga til að hætta."
echo "────────────────────────────────────────────"
python3 serve.py 8080
