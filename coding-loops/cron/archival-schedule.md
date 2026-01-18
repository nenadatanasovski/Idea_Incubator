# Observability Log Archival Schedule

## Recommended Cron Jobs

### Daily Archival (Transcripts)

Run at 2:00 AM daily to archive transcript data older than 7 days.

```cron
0 2 * * * cd /path/to/project && python3 coding-loops/cli.py archive transcripts --older-than 7d >> coding-loops/logs/archival.log 2>&1
```

### Weekly Archival (Assertions)

Run at 3:00 AM every Sunday to archive assertion data older than 30 days.

```cron
0 3 * * 0 cd /path/to/project && python3 coding-loops/cli.py archive assertions --older-than 30d >> coding-loops/logs/archival.log 2>&1
```

### Monthly Cleanup

Run at 4:00 AM on the 1st of each month to consolidate warm -> cold and purge expired.

```cron
0 4 1 * * cd /path/to/project && python3 coding-loops/cli.py cleanup archives --older-than 30d >> coding-loops/logs/archival.log 2>&1
```

## Installation

### Linux/macOS

```bash
# Edit crontab
crontab -e

# Add the above entries, adjusting paths as needed
```

### systemd Timer (Alternative)

Create `/etc/systemd/system/observability-archival.timer`:

```ini
[Unit]
Description=Observability Log Archival

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

Create `/etc/systemd/system/observability-archival.service`:

```ini
[Unit]
Description=Run Observability Archival

[Service]
Type=oneshot
WorkingDirectory=/path/to/project
ExecStart=/usr/bin/python3 coding-loops/cli.py archive all --older-than 7d
```

Enable:

```bash
sudo systemctl enable observability-archival.timer
sudo systemctl start observability-archival.timer
```

## Monitoring

### Check Last Run

```bash
# View archival log
tail -100 coding-loops/logs/archival.log

# Check retention status
python3 coding-loops/cli.py retention status
```

### Alerts

Consider setting up alerts for:

- Archival job failures
- Archive directory size exceeding threshold
- Hot storage exceeding configured retention

## Disk Space Planning

Estimate storage requirements based on activity:

| Metric                   | Estimate |
| ------------------------ | -------- |
| Transcript entries/day   | ~10,000  |
| Tool uses/day            | ~50,000  |
| Compressed size/month    | ~50 MB   |
| Annual warm archive size | ~600 MB  |
| Annual cold archive size | ~200 MB  |

Adjust `cold_days` in retention policies if storage is limited.
