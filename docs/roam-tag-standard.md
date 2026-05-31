# Roam Tag Standard

This standard applies to file-level `tags:` metadata in notes under `roam/`.
It does not apply to inline anchor targets such as `id#anchor-tag`.

## Format

Use one comma-separated `tags:` line inside the note metadata block:

```md
#+begin meta
tags: algebra, linear-algebra, math, reading
#+end meta
```

Keep tags sorted lexicographically. Aaronnote treats tags case-insensitively,
but the files should use one canonical spelling so indexes do not fragment.

## Naming Rules

- Use lowercase for English tags: `philosophy`, not `Philosophy`.
- Use kebab-case for multi-word English tags: `linear-algebra`, not
  `linear_algebra`, `linear\_algebra`, or `Linear Algebra`.
- Keep Chinese topic tags as normal Chinese text: `哲学`, `唯物主义`.
- Prefer singular nouns unless the plural is the established concept:
  `book`, not `books`; `statistics` remains valid.
- Do not escape characters inside a tag. In particular, do not write `\_`.
- Do not add both an abbreviation and its expanded synonym to the same
  vocabulary. This workspace uses `qc` for quantum-computing context.
- Avoid low-information tags such as `note`. Replace them with a domain,
  activity, or subject tag such as `cryptography`, `reading-group`, `lean`, or
  `workshop`.
- Remove duplicates after case normalization.

## Tag Roles

The tag list is flat. Use a small combination of tags from these roles when
they improve retrieval:

| Role | Examples |
| --- | --- |
| Domain | `math`, `qc`, `philosophy` |
| Topic | `algebra`, `tensor`, `cryptography`, `linear-algebra` |
| Material type | `book`, `reading`, `reading-group`, `project`, `workshop` |
| Lifecycle | `draft`, `working` |

Most notes should need only a few tags. A tag should help group related notes;
the folder path, title, and body text already remain searchable.

## Canonical Replacements

Use these replacements when maintaining existing notes:

| Avoid | Use |
| --- | --- |
| `Philosophy` | `philosophy` |
| `Read` | `reading` |
| `books` | `book` |
| `QC`, `quantum` when used for the QC domain | `qc` |
| `Strassen` | `strassen` |
| `linear_algebra`, `linear\_algebra` | `linear-algebra` |
| `bilinear_maps`, `bilinear\_maps` | `bilinear-maps` |
| `tensor_complexity`, `tensor\_complexity` | `tensor-complexity` |

## Maintenance Check

After changing tags:

```sh
rg -n --follow -g '*.md' -g '!**/.lean/**' -g '!**/.lake/**' '^tags:' roam
make maintain
make publish
```

Review the `roam/` repository separately from this repository because `roam/`
is a symlink to its own Git repository.
