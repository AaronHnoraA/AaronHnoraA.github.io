document.addEventListener("DOMContentLoaded", () => {
        // --- debug 开始 ---
        console.log("Checking data...");
        if (typeof d3 === 'undefined') {
            console.error("❌ D3.js 未加载！请检查网络或 CDN 链接。");
            document.getElementById('graph-container').innerHTML = "Error: D3 library not loaded.";
            return;
        }
        if (typeof SITE_DATA === 'undefined') {
            console.error("❌ SITE_DATA 未找到！请检查 js/data.js 是否存在。");
            document.getElementById('graph-container').innerHTML = "Error: Data not found.";
            return;
        }
        console.log("✅ Data found:", SITE_DATA);
        // --- debug 结束 ---

        // 1. 数据清洗：将 Emacs 的分类对象 {"Math": [...], "Code": [...]} 拍平为数组
        const allNotes = [];
        Object.keys(SITE_DATA).forEach(category => {
            const notes = SITE_DATA[category];
            notes.forEach(note => {
                // 确保 tags 是数组
                note.tags = Array.isArray(note.tags) ? note.tags : [];
                note.category = category; // 记录原始分类
                allNotes.push(note);
            });
        });

        if (allNotes.length === 0) {
            document.getElementById('graph-container').innerHTML = "No notes to display.";
            return;
        }

        // 2. 提取节点 (Nodes) 和 连线 (Links)
        const nodes = [];
        const links = [];
        const tagSet = new Set();
        const noteIdSet = new Set();

        // 2.1 添加笔记节点
        allNotes.forEach(note => {
            nodes.push({ 
                id: note.title, 
                group: 'note', 
                radius: 6,
                link: note.link, // 用于点击跳转
                desc: note.desc
            });
            noteIdSet.add(note.title);

            // 2.2 收集标签并建立连接
            note.tags.forEach(tag => {
                tagSet.add(tag);
                links.push({ source: note.title, target: tag });
            });
        });

        // 2.3 添加标签节点
        tagSet.forEach(tag => {
            nodes.push({ id: tag, group: 'tag', radius: 10 });
        });

        // 3. 初始化画布
        const container = document.getElementById("graph-container");
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 600;

        // 清空容器（防止重复渲染）
        container.innerHTML = "";

        const svg = d3.select("#graph-container")
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("viewBox", [0, 0, width, height])
            .call(d3.zoom().on("zoom", (event) => {
                g.attr("transform", event.transform);
            }));

        const g = svg.append("g");

        // 4. 力导向模拟
        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id(d => d.id).distance(80))
            .force("charge", d3.forceManyBody().strength(-200))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide().radius(d => d.radius + 5).iterations(2));

        // 5. 绘制元素
        // 连线
        const link = g.append("g")
            .attr("stroke", "#999")
            .attr("stroke-opacity", 0.6)
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke-width", 1);

        // 节点
        const node = g.append("g")
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .selectAll("circle")
            .data(nodes)
            .join("circle")
            .attr("r", d => d.radius)
            .attr("fill", d => d.group === 'tag' ? '#ff9f43' : '#4a90e2')
            .attr("cursor", "pointer")
            .call(drag(simulation));

        // 节点文字
        const text = g.append("g")
            .selectAll("text")
            .data(nodes)
            .join("text")
            .text(d => d.id)
            .attr("x", 12)
            .attr("y", 3)
            .attr("font-size", "10px")
            .attr("fill", "#333")
            .style("pointer-events", "none"); // 防止文字遮挡点击

        // 6. 添加交互
        // 点击节点
        node.on("click", (event, d) => {
            if (d.group === 'note' && d.link) {
                // 如果是笔记，跳转
                window.location.href = d.link;
            } else if (d.group === 'tag') {
                // 如果是标签，联动下方的搜索框 (可选)
                console.log("Clicked tag:", d.id);
                // 这里可以调用 app.js 里的过滤函数，如果有暴露的话
            }
        });

        // 鼠标悬停显示 Title/Desc
        node.append("title")
            .text(d => d.group === 'note' ? `${d.id}\n${d.desc || ''}` : `Tag: ${d.id}`);

        // 7. 每一帧更新位置
        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);
            
            text
                .attr("x", d => d.x + 8)
                .attr("y", d => d.y + 3);
        });

        // 拖拽函数
        function drag(simulation) {
            function dragstarted(event) {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                event.subject.fx = event.subject.x;
                event.subject.fy = event.subject.y;
            }
            function dragged(event) {
                event.subject.fx = event.x;
                event.subject.fy = event.y;
            }
            function dragended(event) {
                if (!event.active) simulation.alphaTarget(0);
                event.subject.fx = null;
                event.subject.fy = null;
            }
            return d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended);
        }
    });
