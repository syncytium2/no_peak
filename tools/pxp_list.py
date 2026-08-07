"""List every wave (and variables/folders) in an Igor .pxp file."""
import sys
from igor2 import packed

path = sys.argv[1]
records, filesystem = packed.load(path)


def walk(node, prefix=""):
    for name, item in node.items():
        label = name.decode() if isinstance(name, bytes) else str(name)
        if isinstance(item, dict):
            walk(item, prefix + label + ":")
        else:
            # item is a record (WaveRecord etc.)
            kind = type(item).__name__
            extra = ""
            if hasattr(item, "wave"):
                try:
                    w = item.wave["wave"]
                    data = w["wData"]
                    hdr = w["wave_header"]
                    sf = (hdr.get("sfA"), hdr.get("sfB")) if hasattr(hdr, "get") else ""
                    extra = f" shape={getattr(data, 'shape', '?')} dtype={getattr(data, 'dtype', '?')} scale={sf}"
                except Exception as e:  # noqa: BLE001
                    extra = f" <unreadable: {e}>"
            print(f"{prefix}{label}  [{kind}]{extra}")


walk(filesystem)
