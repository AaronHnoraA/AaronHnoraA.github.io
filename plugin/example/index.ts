// Draft plugin entry. The runtime loader is not wired yet.
// Intended syntax:
//   @@example(info) [inline context]{arg: value}
//   #+begin example Optional title
//   block content
//   #+end example

export const plugin = {
  id: "example",
  commands: ["example"],
  blocks: ["example"],
};
