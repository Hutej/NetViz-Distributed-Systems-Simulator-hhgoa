"""Ad-hoc end-to-end check for the WebSocket broadcast path.

Connects to /ws/simulation/ with a minimal stdlib WebSocket client, triggers
REST mutations, and verifies the server pushes the updated simulation state
to connected clients. Run against a live dev server:

    ./venv/Scripts/python.exe scripts/ws_check.py [base_url]
"""

import base64
import json
import os
import socket
import struct
import sys
import urllib.parse
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"


class WsConnection:
    """Minimal WS client: buffers bytes so reads never lose partial frames."""

    def __init__(self, sock: socket.socket):
        self.sock = sock
        self.buffer = b""

    def _fill(self) -> None:
        chunk = self.sock.recv(4096)
        if not chunk:
            raise ConnectionError("socket closed")
        self.buffer += chunk

    def _take(self, count: int) -> bytes:
        while len(self.buffer) < count:
            self._fill()
        data, self.buffer = self.buffer[:count], self.buffer[count:]
        return data

    def recv_text(self) -> dict:
        """Read one complete (possibly fragmented) text frame as JSON."""
        chunks = []
        while True:
            b1, b2 = self._take(2)
            fin, opcode, masked, length = b1 >> 7, b1 & 0x0F, b2 >> 7, b2 & 0x7F
            if length == 126:
                (length,) = struct.unpack(">H", self._take(2))
            elif length == 127:
                (length,) = struct.unpack(">Q", self._take(8))
            assert not masked, "server frames must not be masked"
            payload = self._take(length)
            if opcode == 0x8:
                raise ConnectionError("server sent close frame")
            if opcode == 0x9:  # ping -> send masked pong, keep reading
                mask = os.urandom(4)
                self.sock.sendall(
                    bytes([0x8A, 0x80 | len(payload)])
                    + mask
                    + bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
                )
                continue
            if opcode in (0x1, 0x0):
                chunks.append(payload)
            if fin:
                return json.loads(b"".join(chunks))

    def close(self) -> None:
        self.sock.close()


def connect_ws(host: str, port: int) -> WsConnection:
    sock = socket.create_connection((host, port), timeout=10)
    key = base64.b64encode(os.urandom(16)).decode()
    request = (
        "GET /ws/simulation/ HTTP/1.1\r\n"
        f"Host: {host}:{port}\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        "Sec-WebSocket-Version: 13\r\n\r\n"
    )
    sock.sendall(request.encode())
    conn = WsConnection(sock)
    while b"\r\n\r\n" not in conn.buffer:
        conn._fill()
    header, conn.buffer = conn.buffer.split(b"\r\n\r\n", 1)
    assert b"101" in header.split(b"\r\n")[0], header
    return conn


def rest_post(path: str, body: dict | None = None):
    request = urllib.request.Request(
        f"{BASE}{path}",
        method="POST",
        data=json.dumps(body or {}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        return response.status, json.loads(response.read())


def main() -> None:
    parsed = urllib.parse.urlparse(BASE)
    host, port = parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80)

    conn = connect_ws(host, port)
    print("[1] WebSocket connected (101 Switching Protocols)")

    initial = conn.recv_text()
    print(f"[2] Initial push received: leader={initial['current_leader']} "
          f"term={initial['current_term']} nodes={len(initial['nodes'])}")

    status, rest_state = rest_post("/api/simulation/election")
    assert status == 200
    print(f"[3] REST POST /api/simulation/election -> {status}")

    update = conn.recv_text()
    assert update["current_term"] == initial["current_term"] + 1, update
    assert update["recent_events"][-1]["type"] == "election"
    print(f"[4] Broadcast received: leader={update['current_leader']} "
          f"term={update['current_term']} — matches REST response: "
          f"{update == rest_state}")

    status, _ = rest_post("/api/simulation/reset")
    assert status == 200
    update = conn.recv_text()
    assert update["current_term"] == 1 and update["current_leader"] == "A"
    print("[5] Reset broadcast received — cluster back to A/B/C")

    conn.close()
    print("WS broadcast check PASSED")


if __name__ == "__main__":
    main()
