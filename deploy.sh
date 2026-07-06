#!/bin/bash
# Birtir breytingar (t.d. eftir að þú vistar í stjórnborðinu) á lifandi vefinn.
# Notkun:  ./deploy.sh
cd "$(dirname "$0")" || exit 1
git add -A
git commit -m "Uppfæra efni" || { echo "Engar breytingar til að birta."; exit 0; }
git push
echo ""
echo "✓ Sent. Lifandi vefurinn uppfærist eftir ~1 mínútu:"
echo "  https://robertspano.github.io/kaffibrennslan/"
