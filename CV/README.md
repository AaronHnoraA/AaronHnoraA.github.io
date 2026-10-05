# Aaron He CV

My curriculum vitae (CV) written in LaTeX.

The source file is [main.tex](main.tex), and the generated PDF is [Aaron_He_CV.pdf](Aaron_He_CV.pdf).

## Build

`make publish-build` in the Emacs configuration compiles it and copies the PDF
here. To compile by hand, keeping intermediates out of the repository:

```sh
latexmk -xelatex -interaction=nonstopmode -halt-on-error \
  -outdir=/tmp/cv -jobname=Aaron_He_CV main.tex && cp /tmp/cv/Aaron_He_CV.pdf .
```
