;;; publish.el --- org-publish config -*- lexical-binding: t; -*-
(require 'ox-publish)
(require 'json)

;; =============================================================================
;; 1. 相对路径辅助函数
;;    功能：自动计算 css/js 的相对路径 (例如 ../../css/style.css)
;;    这就允许你在本地直接打开 html 文件，而不需要启动 web server
;; =============================================================================
(defun my/org-html-publish-to-html-relative (plist filename pub-dir)
  (let* ((root (plist-get plist :base-directory))
         (rel-path (file-relative-name filename root))
         (rel-dir (file-name-directory rel-path))
         (dirs (if rel-dir (split-string rel-dir "/" t) '()))
         (depth (length dirs))
         ;; 生成前缀，例如 ".." 或 "../.."
         (prefix (if (> depth 0) (mapconcat (lambda (_) "..") dirs "/") "."))
         ;; 拼接 CSS 和 JS 路径
         (css-path (format "%s/css/style.css" prefix))
         (js-path (format "%s/js/app.js" prefix))
         (data-path (format "%s/js/data.js" prefix)) ; 确保 data.js 也被引用
         ;; 注入 HTML Head
         (new-head (format 
                    "<link rel=\"stylesheet\" href=\"%s\" />\n<script src=\"%s\"></script>\n<script src=\"%s\"></script>\n
  <link rel=\"shortcut icon\" href=\"https://aaron.pwo101.top/css/cv.svg\" type=\"image/x-icon\">
                    " 
                    css-path data-path js-path)))
    (org-html-publish-to-html
     (plist-put (copy-sequence plist) :html-head new-head)
     filename pub-dir)))

;; =============================================================================
;; 2. 数据生成器 & Sitemap
;;    功能：遍历所有 Org 文件，提取元数据，生成 js/data.js
;;          同时将 homepage.html 复制为 index.html
;; =============================================================================
(defun my/generate-data-and-index (title _list)
  "生成 js/data.js 并复制 homepage.html 为 index.html"
  (let* ((project-name "site-org")
         (project (assoc project-name org-publish-project-alist)))
    
    (unless project (error "找不到项目配置: %s" project-name))

    (let* ((project-plist (cdr project))
           (base-dir (expand-file-name (plist-get project-plist :base-directory)))
           (pub-dir (expand-file-name (plist-get project-plist :publishing-directory)))
           (template-file (expand-file-name "homepage.html" base-dir))
           (js-dir (expand-file-name "js" pub-dir))
           (files (org-publish-get-base-files project))
           ;; 使用 hash-table 临时存储分类数据
           (data-map (make-hash-table :test 'equal)))

      ;; --- 步骤 1: 提取所有笔记数据 ---
      (dolist (file files)
        (let* ((rel-path (file-relative-name file base-dir))
               (filename (file-name-nondirectory file))
               ;; 排除 sitemap 本身和隐藏文件
               (is-sitemap (string-match "sitemap-log.org" filename)) 
               (is-hidden (string-prefix-p "." filename)))
          
          (unless (or is-sitemap is-hidden)
            (let* ((dir-name (file-name-directory rel-path))
                   ;; 确定分类 (文件夹名)
                   (category (if (and dir-name (not (string= dir-name "./")))
                                 (directory-file-name dir-name)
                               "Root"))
                   ;; 获取标题
                   (file-title (or (org-publish-find-title file t) 
                                   (file-name-sans-extension filename)))
                   ;; 获取日期
                   (date (format-time-string "%Y-%m-%d" 
                                             (org-publish-find-date file project)))
                   ;; [关键] 获取标签并转为 Vector (确保 JSON 输出为数组 ["a", "b"])
                   (raw-tags (org-publish-find-property file :filetags project))
                   (tags (if raw-tags (vconcat raw-tags) []))
                   
                   ;; [新增] 获取描述 (#+DESCRIPTION)
                   (desc (or (org-publish-find-property file :description project) ""))
                   
                   ;; 生成链接
                   (link (concat (file-name-sans-extension rel-path) ".html"))
                   
                   ;; 构建单个文件的数据对象
                   (file-obj `(("title" . ,file-title)
                               ("link"  . ,link)
                               ("date"  . ,date)
                               ("tags"  . ,tags)
                               ("desc"  . ,desc))))
              
              ;; 将文件对象加入对应的分类列表
              (let ((existing (gethash category data-map)))
                (puthash category (cons file-obj existing) data-map))))))

      ;; --- 步骤 2: 写入 js/data.js ---
      (unless (file-exists-p js-dir) (make-directory js-dir t))
      (with-temp-file (expand-file-name "data.js" js-dir)
        (insert "const SITE_DATA = ")
        ;; 将 Hash Table 转为 Alist 以确保 JSON 编码正确
        (let ((output-alist '())
              (json-encoding-pretty-print nil)) ; 设为 t 可方便调试，但文件会大
          (maphash (lambda (k v) (push (cons k v) output-alist)) data-map)
          (insert (json-encode output-alist)))
        (insert ";"))
      
      ;; --- 步骤 3: 复制首页模板 ---
      (if (file-exists-p template-file)
          (copy-file template-file (expand-file-name "index.html" pub-dir) t)
        (message "警告: 找不到 homepage.html 模板，未生成 index.html"))
      
      ;; 返回值：这会写入 sitemap-log.org，内容不重要
      "* Sitemap generation log (Ignore this file)")))

;; =============================================================================
;; 3. 项目配置
;; =============================================================================
(setq org-publish-project-alist
      '(("site-org"
         :base-directory "~/HC/Org/"
         :base-extension "org"
         :publishing-directory "~/HC/Org/public/"
         :recursive t
         :publishing-function my/org-html-publish-to-html-relative
         
         ;; 排除不需要处理的文件和文件夹
         :exclude "public/\\|ltximg/\\|homepage.html\\|js/\\|css/"
         
         ;; 启用 Sitemap 生成器来生成 JSON 数据
         :auto-sitemap t
         :sitemap-title "Ignored"
         :sitemap-filename "sitemap-log.org" 
         :sitemap-function my/generate-data-and-index)

        ("site-static"
         :base-directory "~/HC/Org/"
         ;; 涵盖所有静态资源类型
         :base-extension "css\\|js\\|png\\|jpg\\|gif\\|svg\\|pdf"
         :publishing-directory "~/HC/Org/public/"
         :recursive t
         :exclude "public/\\|ltximg/"
         :publishing-function org-publish-attachment)

        ("site" :components ("site-org" "site-static"))))

;; 允许导出损坏的链接（避免因死链导致发布失败）
(setq org-export-with-broken-links t)
;; 不生成默认的验证链接
(setq org-html-validation-link nil)
