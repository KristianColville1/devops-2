import json
import os

_STATE_FILE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "devops2-state.json",
)


def read():
    """Return the current state dict, or an empty dict if the file doesn't exist yet."""
    if not os.path.isfile(_STATE_FILE):
        return {}
    with open(_STATE_FILE) as f:
        return json.load(f)


def write(data):
    """Overwrite the state file with the given dict."""
    with open(_STATE_FILE, "w") as f:
        json.dump(data, f, indent=2)


def update(**kwargs):
    """Merge kwargs into the existing state and persist it."""
    data = read()
    data.update(kwargs)
    write(data)
    return data


def get(key, default=None):
    """Read a single value from the state file."""
    return read().get(key, default)
