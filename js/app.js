document.addEventListener('DOMContentLoaded', () => {
    // 1. 安全检查
    if (typeof SITE_DATA === 'undefined') {
        console.error('SITE_DATA is missing. Make sure data.js is loaded.');
        document.getElementById('app-tabs').innerHTML = '<div class="error">Data load failed.</div>';
        return;
    }

    // --- DOM 元素 ---
    const app = document.getElementById('app-tabs');
    const searchWrapper = document.querySelector('.search-wrapper');
    const searchInput = document.getElementById('note-search');
    const resetBtn = document.getElementById('reset-search');
    const tagCloud = document.getElementById('tag-cloud');
    const sortSelect = document.getElementById('sort-select');
    const themeToggle = document.getElementById('theme-toggle');

    // 创建自动补全下拉菜单
    const suggestionBox = document.createElement('div');
    suggestionBox.className = 'autocomplete-suggestions';
    searchWrapper.appendChild(suggestionBox);

    // --- 状态管理 ---
    let currentFilter = { 
        text: '', 
        tags: new Set() 
    };
    let currentSort = 'date-desc';
    let allFiles = [];
    let isComposing = false; // 用于解决中文输入法过程中的搜索触发问题
    let searchDebounceTimer = null; // 防抖定时器

    // --- 1. 数据扁平化 (Flatten Data) ---
    Object.keys(SITE_DATA).forEach(folder => {
        SITE_DATA[folder].forEach(file => {
            file.folder = folder;
            // 数据清洗：确保 tags 是数组且不含空值
            let rawTags = Array.isArray(file.tags) ? file.tags : (file.tags ? [file.tags] : []);
            file.tags = rawTags.filter(t => t && t.trim() !== ''); 
            allFiles.push(file);
        });
    });

    // --- 2. 核心功能函数 ---

    // 防抖函数：避免频繁渲染
    function debounce(func, wait) {
        return function(...args) {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // 从 URL 读取状态
    function readUrlState() {
        const params = new URLSearchParams(window.location.search);
        
        // 读取搜索文本
        if (params.has('q')) {
            currentFilter.text = params.get('q');
            searchInput.value = currentFilter.text;
        } else {
            currentFilter.text = '';
            searchInput.value = '';
        }

        // 读取标签
        currentFilter.tags.clear();
        if (params.has('tags')) {
            const tagParam = params.get('tags');
            if(tagParam) {
                tagParam.split(',').forEach(t => currentFilter.tags.add(decodeURIComponent(t)));
            }
        }

        // 读取排序
        if (params.has('sort')) {
            currentSort = params.get('sort');
            sortSelect.value = currentSort;
        }

        // 返回 Hash 用于 Tab 定位
        return decodeURIComponent(window.location.hash.substring(1));
    }

    // 更新 URL 状态
    function updateUrlState() {
        const params = new URLSearchParams();
        if (currentFilter.text) params.set('q', currentFilter.text);
        if (currentFilter.tags.size > 0) {
            // Encode tags properly
            const tagsArr = Array.from(currentFilter.tags).map(t => encodeURIComponent(t));
            params.set('tags', tagsArr.join(','));
        }
        if (currentSort !== 'date-desc') params.set('sort', currentSort);
        
        const newQuery = params.toString() ? '?' + params.toString() : '';
        const newUrl = `${window.location.pathname}${newQuery}${window.location.hash}`;
        
        // 只有当 URL 真正变化时才 pushState，避免历史记录污染
        if (window.location.search !== ('?' + params.toString())) {
             window.history.pushState(null, '', newUrl);
        } else {
             window.history.replaceState(null, '', newUrl);
        }
    }

    // 排序逻辑
    function sortFiles(files) {
        return files.sort((a, b) => {
            if (currentSort === 'date-desc') return new Date(b.date) - new Date(a.date);
            if (currentSort === 'date-asc') return new Date(a.date) - new Date(b.date);
            if (currentSort === 'title-asc') return a.title.localeCompare(b.title);
            return 0;
        });
    }

    // 高亮文本辅助函数
    function highlightText(text, keyword) {
        if (!keyword) return text;
        // 转义正则特殊字符
        const safeKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${safeKeyword})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    // --- 3. 渲染逻辑 (UI) ---

    function renderTags() {
        // 收集所有去重标签
        const allTags = new Set();
        allFiles.forEach(f => f.tags.forEach(t => allTags.add(t)));
        
        tagCloud.innerHTML = '';
        
        // 渲染“清除”按钮
        if (currentFilter.tags.size > 0) {
            const clearBtn = document.createElement('button');
            clearBtn.className = 'clear-tags-btn';
            clearBtn.innerHTML = `<i class="fas fa-times"></i> Clear (${currentFilter.tags.size})`;
            clearBtn.onclick = () => {
                currentFilter.tags.clear();
                updateUI();
            };
            tagCloud.appendChild(clearBtn);
        }

        // 渲染标签 Chips
        Array.from(allTags).sort().forEach(tag => {
            const span = document.createElement('span');
            const isActive = currentFilter.tags.has(tag);
            span.className = `tag-chip ${isActive ? 'active' : ''}`;
            span.textContent = tag;
            
            span.onclick = () => {
                if (currentFilter.tags.has(tag)) {
                    currentFilter.tags.delete(tag);
                } else {
                    currentFilter.tags.add(tag);
                }
                updateUI();
            };
            tagCloud.appendChild(span);
        });
    }

    function renderTabs(filesToRender, targetTabHash) {
        app.innerHTML = '';

        if (filesToRender.length === 0) {
            app.innerHTML = '<div class="empty-state">No notes found matching your criteria.</div>';
            return;
        }

        const grouped = {};
        filesToRender.forEach(file => {
            if (!grouped[file.folder]) grouped[file.folder] = [];
            grouped[file.folder].push(file);
        });

        // 排序文件夹：Root 始终在第一位
        const folders = Object.keys(grouped).sort((a, b) => {
            if (a === 'Root') return -1;
            if (b === 'Root') return 1;
            return a.localeCompare(b);
        });

        const btnContainer = document.createElement('div');
        btnContainer.className = 'tab-buttons';
        app.appendChild(btnContainer);

        const contentContainer = document.createElement('div');
        contentContainer.className = 'tab-contents';
        app.appendChild(contentContainer);

        // 智能 Tab 激活逻辑：
        // 1. 尝试保持 URL hash 指定的 Tab
        // 2. 如果该 Tab 在当前筛选下不存在，尝试保持之前激活的 Tab (通过 DOM class 检查有点麻烦，简化处理)
        // 3. 否则默认第一个
        let activeFolder = folders[0];
        if (targetTabHash && folders.includes(targetTabHash)) {
            activeFolder = targetTabHash;
        } else {
            // 如果 hash 对应的 tab 没了（比如被筛选掉了），更新 hash 为第一个可见的
            // 避免用户困惑
            if (folders.length > 0) {
                activeFolder = folders[0];
                // 仅替换 hash，不产生历史记录
                window.history.replaceState(null, '', `#${activeFolder}`); 
            }
        }

        folders.forEach(folderName => {
            const isActive = folderName === activeFolder;

            // Tab 按钮
            const btn = document.createElement('button');
            btn.className = `tab-btn ${isActive ? 'active' : ''}`;
            btn.dataset.tab = folderName; 
            btn.innerHTML = `${folderName} <span class="badge">${grouped[folderName].length}</span>`;
            
            btn.onclick = () => {
                switchTab(folderName);
                window.history.replaceState(null, '', `#${folderName}`);
                // 每次切换 tab 也更新一下 URL 状态（保留 search params）
                updateUrlState(); 
            };
            btnContainer.appendChild(btn);

            // Tab 内容
            const pane = document.createElement('div');
            pane.id = `tab-content-${folderName}`;
            pane.className = `tab-content ${isActive ? 'active' : ''}`;
            
            const ul = document.createElement('ul');
            ul.className = 'file-list';
            
            grouped[folderName].forEach(file => {
                const li = document.createElement('li');
                
                // 标签高亮
                const tagHtml = file.tags.map(t => {
                    const isTagActive = currentFilter.tags.has(t);
                    return `<span class="tag-small ${isTagActive ? 'highlight' : ''}">#${t}</span>`;
                }).join('');
                
                // 标题高亮 (支持多关键词)
                let titleHtml = file.title;
                if (currentFilter.text) {
                    const terms = currentFilter.text.trim().split(/\s+/);
                    terms.forEach(term => {
                        if(term) titleHtml = highlightText(titleHtml, term);
                    });
                }

                li.innerHTML = `
                    <div class="file-info">
                        <a href="${file.link}" class="file-link">${titleHtml}</a>
                        <div class="file-meta">
                            ${tagHtml}
                            <span class="file-date"><i class="far fa-calendar-alt"></i> ${file.date}</span>
                        </div>
                    </div>
                `;
                ul.appendChild(li);
            });
            pane.appendChild(ul);
            contentContainer.appendChild(pane);
        });
    }

    function switchTab(targetName) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(p => p.classList.remove('active'));

        const targetBtn = document.querySelector(`.tab-btn[data-tab="${targetName}"]`);
        const targetPane = document.getElementById(`tab-content-${targetName}`);
        
        if (targetBtn) targetBtn.classList.add('active');
        if (targetPane) targetPane.classList.add('active');
    }

    // --- 4. 搜索建议逻辑 (修复点击 Bug) ---
    function showSuggestions(query) {
        suggestionBox.innerHTML = '';
        if (!query || query.trim() === '') {
            suggestionBox.style.display = 'none';
            return;
        }

        const lowerQuery = query.toLowerCase();
        
        // 匹配标签
        const allTags = new Set();
        allFiles.forEach(f => f.tags.forEach(t => allTags.add(t)));
        const matchedTags = Array.from(allTags)
            .filter(t => t.toLowerCase().includes(lowerQuery));

        // 匹配笔记标题
        const matchedTitles = allFiles
            .filter(f => f.title.toLowerCase().includes(lowerQuery))
            .slice(0, 5);

        if (matchedTags.length === 0 && matchedTitles.length === 0) {
            suggestionBox.style.display = 'none';
            return;
        }

        // 渲染标签建议
        matchedTags.forEach(tag => {
            const div = document.createElement('div');
            div.className = 'suggestion-item tag-suggestion';
            div.innerHTML = `<i class="fas fa-tag"></i> ${tag}`;
            div.onclick = (e) => {
                e.stopPropagation(); // 防止冒泡
                
                // 核心修复：选中建议后，必须清空 text filter，否则会变成 Tag + Text 同时筛选
                currentFilter.tags.add(tag);
                currentFilter.text = ''; 
                searchInput.value = ''; 
                
                suggestionBox.style.display = 'none';
                updateUI();
            };
            suggestionBox.appendChild(div);
        });

        // 渲染笔记建议
        if (matchedTitles.length > 0 && matchedTags.length > 0) {
             const divider = document.createElement('div');
             divider.className = 'suggestion-divider';
             divider.innerText = 'Notes';
             suggestionBox.appendChild(divider);
        }

        matchedTitles.forEach(file => {
            const div = document.createElement('div');
            div.className = 'suggestion-item note-suggestion';
            div.innerHTML = `<i class="far fa-file-alt"></i> ${file.title}`;
            div.onclick = () => {
                window.location.href = file.link;
            };
            suggestionBox.appendChild(div);
        });

        suggestionBox.style.display = 'block';
    }

    function updateUI() {
        // 1. 过滤
        let filtered = allFiles.filter(file => {
            // 文本匹配：支持空格分隔的多个关键词 (AND 逻辑)
            const searchTerms = currentFilter.text.toLowerCase().trim().split(/\s+/).filter(t => t);
            
            const textMatch = searchTerms.length === 0 || searchTerms.every(term => 
                file.title.toLowerCase().includes(term) || 
                file.tags.some(t => t.toLowerCase().includes(term))
            );

            // 标签匹配：必须包含所有选中的标签 (AND 逻辑)
            const tagsMatch = currentFilter.tags.size === 0 || 
                              Array.from(currentFilter.tags).every(selectedTag => file.tags.includes(selectedTag));
            
            return textMatch && tagsMatch;
        });

        // 2. 排序
        filtered = sortFiles(filtered);

        // 3. 渲染
        // 注意：先 updateUrlState 再 render，或者反过来，
        // 这里我们选择先渲染界面，再更新 URL，逻辑更顺畅
        renderTags(); 
        // 传入当前的 hash，以便 renderTabs 决定激活哪个 tab
        renderTabs(filtered, window.location.hash.substring(1));

        // 4. 更新 URL
        updateUrlState();

        // 5. 控件状态
        const hasFilters = currentFilter.text || currentFilter.tags.size > 0;
        resetBtn.style.display = hasFilters ? 'block' : 'none';
        
        // 如果文本框空了，隐藏建议框
        if (!currentFilter.text) suggestionBox.style.display = 'none';
    }

    // --- 事件监听 ---

    // 1. 搜索框：支持防抖和中文输入法 (IME)
    searchInput.addEventListener('compositionstart', () => { isComposing = true; });
    searchInput.addEventListener('compositionend', (e) => {
        isComposing = false;
        // 补发一次 input 事件或直接触发处理
        handleSearchInput(e.target.value);
    });

    searchInput.addEventListener('input', (e) => {
        if (isComposing) return; // 正在输入中文时不触发
        handleSearchInput(e.target.value);
    });

    // 抽离搜索处理逻辑
    const handleSearchInput = debounce((val) => {
        currentFilter.text = val;
        showSuggestions(val);
        updateUI();
    }, 200); // 200ms 延迟

    // 2. 键盘控制
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            suggestionBox.style.display = 'none';
            searchInput.blur();
        }
        // 可选：支持上下键选择建议（略，增加复杂度）
    });

    // 3. 全局点击：关闭下拉框
    document.addEventListener('click', (e) => {
        if (!searchWrapper.contains(e.target)) {
            suggestionBox.style.display = 'none';
        }
    });

    // 4. 重置按钮
    resetBtn.addEventListener('click', () => {
        currentFilter.text = '';
        currentFilter.tags.clear();
        searchInput.value = '';
        
        // 强制清空 URL 参数但保留 Hash
        const hash = window.location.hash;
        window.history.pushState(null, '', window.location.pathname + hash);
        
        updateUI();
    });

    // 5. 排序下拉
    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        updateUI();
    });

    // 6. 浏览器后退/前进 (历史记录支持)
    window.addEventListener('popstate', () => {
        readUrlState();
        // 强制不带 pushState 更新 UI
        // 这里不能直接调用 updateUI，因为 updateUI 内部会调用 updateUrlState(push/replace)
        // 我们需要一个只渲染不改 URL 的流程，或者让 updateUrlState 变聪明。
        // 由于我们在 updateUrlState 里做了检测 (window.location.search check)，所以直接调用也是安全的。
        
        // 重新过滤并渲染
        let filtered = allFiles.filter(file => {
             const searchTerms = currentFilter.text.toLowerCase().trim().split(/\s+/).filter(t => t);
             const textMatch = searchTerms.length === 0 || searchTerms.every(term => 
                 file.title.toLowerCase().includes(term) || file.tags.some(t => t.toLowerCase().includes(term))
             );
             const tagsMatch = currentFilter.tags.size === 0 || 
                               Array.from(currentFilter.tags).every(tag => file.tags.includes(tag));
             return textMatch && tagsMatch;
        });
        filtered = sortFiles(filtered);
        renderTags();
        renderTabs(filtered, window.location.hash.substring(1));
    });

// --- Dark Mode ---
    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        
        // 逻辑修改：
        // 只有当本地存储明确记录为 'dark' 时，才开启暗色模式。
        // 其他情况（null 或者 'light'）一律默认为亮色。
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        } else {
            // 确保移除 dark-mode 类，显示月亮图标（代表当前是亮色，点击切换到暗色）
            document.body.classList.remove('dark-mode');
            themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        }
    }

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        // 保存用户的选择
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        themeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    });
    // --- 启动 ---
    initTheme();
    readUrlState(); 
    // 首次渲染不需要 debounce
    updateUI();
});
