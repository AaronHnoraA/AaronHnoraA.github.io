#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "agent" / "db" / "org-roam.sqlite3"


def connect() -> sqlite3.Connection:
    if not DB_PATH.exists():
        raise SystemExit(f"Database link not found: {DB_PATH}")
    connection = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def table(headers: list[str], rows: list[sqlite3.Row]) -> str:
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
    ]
    for row in rows:
        values = [str(row[header] if row[header] is not None else "") for header in headers]
        values = [value.replace("|", "\\|").replace("\n", " ") for value in values]
        lines.append("| " + " | ".join(values) + " |")
    return "\n".join(lines)


def summary(connection: sqlite3.Connection) -> None:
    node_count = connection.execute("select count(*) as count from nodes").fetchone()["count"]
    link_count = connection.execute("select count(*) as count from links").fetchone()["count"]
    print(f"nodes: {node_count}")
    print(f"links: {link_count}")


def nodes(connection: sqlite3.Connection) -> None:
    rows = connection.execute(
        "select title, path, tags, id from nodes order by lower(title)"
    ).fetchall()
    print(table(["title", "path", "tags", "id"], rows))


def links(connection: sqlite3.Connection) -> None:
    rows = connection.execute(
        """
        select source_path, target_title, target_path, line
        from links
        order by source_path, line
        """
    ).fetchall()
    print(table(["source_path", "target_title", "target_path", "line"], rows))


def find_node(connection: sqlite3.Connection, query: str) -> None:
    like = f"%{query}%"
    rows = connection.execute(
        """
        select title, path, tags, id
        from nodes
        where id = ? or title like ? or path like ?
        order by lower(title)
        """,
        (query, like, like),
    ).fetchall()
    print(table(["title", "path", "tags", "id"], rows))


def main() -> None:
    parser = argparse.ArgumentParser(description="Read the linked org-roam SQLite database.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("summary")
    subparsers.add_parser("nodes")
    subparsers.add_parser("links")
    node_parser = subparsers.add_parser("node")
    node_parser.add_argument("query")

    args = parser.parse_args()
    with connect() as connection:
        if args.command == "summary":
            summary(connection)
        elif args.command == "nodes":
            nodes(connection)
        elif args.command == "links":
            links(connection)
        elif args.command == "node":
            find_node(connection, args.query)


if __name__ == "__main__":
    main()
