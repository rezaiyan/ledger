PI_HOST  := ali@pi5.local
PI_DIR   := ~/ledger
RSYNC    := rsync -av --exclude node_modules --exclude dist --exclude .git --exclude sessions

.PHONY: deploy sync restart status logs

# Full deploy: sync + install + restart
deploy:
	$(RSYNC) ./ $(PI_HOST):$(PI_DIR)/
	ssh $(PI_HOST) "cd $(PI_DIR) && npm install --omit=dev && sudo systemctl restart ledger && sleep 3 && systemctl is-active ledger"

# Sync code only (no install, no restart) — for quick edits
sync:
	$(RSYNC) ./ $(PI_HOST):$(PI_DIR)/
	ssh $(PI_HOST) "sudo systemctl restart ledger && sleep 2 && systemctl is-active ledger"

# Restart service only
restart:
	ssh $(PI_HOST) "sudo systemctl restart ledger && sleep 2 && systemctl is-active ledger"

# Check service status
status:
	ssh $(PI_HOST) "systemctl status ledger --no-pager -l"

# Tail live logs
logs:
	ssh $(PI_HOST) "sudo journalctl -u ledger -f"
