#!/usr/bin/env python3
"""ping@all - say "hi" on every terminal that is logged in as this account.

Finds every terminal (tty/pty) that belongs to the current user and writes a
short banner to it, so a friend who is logged in to the same account but not
in the game sees that you want to play.  Works on macOS and Linux and needs no
special permissions because you always own your own terminals.

Usage:
    ./ping@all                 -> "hi"
    ./ping@all come farm!      -> a custom message
    python3 pingall.py --from Yutong "hi"
"""
import os
import subprocess
import sys
import time


def current_tty():
    for fd in (0, 1, 2):
        try:
            return os.ttyname(fd)
        except OSError:
            pass
    return None


def user_ttys():
    """Return the device paths of all terminals owned by the current user."""
    uid = os.getuid()
    found = set()
    try:
        out = subprocess.run(["ps", "-u", str(uid), "-o", "tty="],
                             capture_output=True, text=True, timeout=5).stdout
        for line in out.splitlines():
            name = line.strip()
            if not name or name in ("?", "??", "-"):
                continue
            path = name if name.startswith("/dev/") else "/dev/" + name
            found.add(path)
    except Exception:
        pass
    # Fall back to scanning /dev directly (catches tmux panes etc.)
    for pattern_dir, prefix in (("/dev/pts", ""), ("/dev", "ttys")):
        try:
            for entry in os.listdir(pattern_dir):
                if prefix and not entry.startswith(prefix):
                    continue
                if pattern_dir == "/dev/pts" and not entry.isdigit():
                    continue
                found.add(os.path.join(pattern_dir, entry))
        except OSError:
            pass
    result = []
    for path in sorted(found):
        try:
            st = os.stat(path)
        except OSError:
            continue
        if st.st_uid == uid and os.access(path, os.W_OK):
            result.append(path)
    return result


def plain(s):
    return "".join(ch for ch in str(s) if ch.isprintable())


def ping_all(sender, text="hi", include_self=False, launch_hint=None):
    """Write the banner to every terminal of this account. Returns tty list."""
    me = current_tty()
    stamp = time.strftime("%H:%M")
    # text can come from anyone who can reach the farm; never pass escape codes to a terminal
    sender, text = plain(sender)[:32], plain(text).strip()[:120] or "hi"
    lines = [
        "",
        "  \a\033[1;33m*\033[0m \033[1mping@all\033[0m from \033[1;36m%s\033[0m at %s" % (sender, stamp),
        "  \033[1;32m%s\033[0m" % text,
    ]
    if launch_hint:
        lines.append("  \033[2m%s\033[0m" % launch_hint)
    lines.append("")
    payload = "".join("\r\n" + l for l in lines) + "\r\n"
    delivered = []
    for path in user_ttys():
        if not include_self and me and os.path.realpath(path) == os.path.realpath(me):
            continue
        try:
            fd = os.open(path, os.O_WRONLY | os.O_NOCTTY | os.O_NONBLOCK)
            try:
                os.write(fd, payload.encode("utf-8", "replace"))
                delivered.append(path)
            finally:
                os.close(fd)
        except OSError:
            continue
    return delivered


def main(argv):
    sender = None
    args = list(argv)
    if "--from" in args:
        i = args.index("--from")
        if i + 1 < len(args):
            sender = args[i + 1]
            del args[i:i + 2]
    include_self = "--self" in args
    args = [a for a in args if a != "--self"]
    text = " ".join(args).strip() or "hi"
    if not sender:
        import getpass
        sender = getpass.getuser()
    here = os.path.dirname(os.path.abspath(__file__))
    hint = "join the farm:  cd %s && python3 farm.py   or open http://localhost:7735" % here.replace(os.path.expanduser("~"), "~", 1)
    ttys = ping_all(sender, text, include_self=include_self, launch_hint=hint)
    if ttys:
        print("Pinged %d terminal%s: %s" % (len(ttys), "" if len(ttys) == 1 else "s",
                                             ", ".join(os.path.basename(t) for t in ttys)))
    else:
        print("No other terminals are logged in as this account right now.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
