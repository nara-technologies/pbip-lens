// @ts-nocheck
(function () {
    'use strict';

    var vscode = acquireVsCodeApi();

    // ── DOM References ──────────────────────────────────────────
    var emptyState = document.getElementById('empty-state');
    var dashboard = document.getElementById('dashboard');
    var metricsGrid = document.getElementById('metrics-grid');
    var statusBadge = document.getElementById('status-badge');
    var statusText = document.getElementById('status-text');
    var searchInput = document.getElementById('search-input');
    var searchResults = document.getElementById('search-results');
    var lineageView = document.getElementById('lineage-view');
    var usedByList = document.getElementById('used-by-list');
    var centerNode = document.getElementById('center-node');
    var dependsOnList = document.getElementById('depends-on-list');
    var orphanBtn = document.getElementById('orphan-btn');
    var orphanResults = document.getElementById('orphan-results');
    var refreshBtn = document.getElementById('refresh-btn');
    var activeCategoryFilter = null;

    // ── Kind Metadata ───────────────────────────────────────────
    var KIND_META = {
        measure:  { icon: 'Σ', cssClass: 'kind-measure',  label: 'Measure' },
        column:   { icon: '▦', cssClass: 'kind-column',   label: 'Column' },
        table:    { icon: '◫', cssClass: 'kind-table',    label: 'Table' },
        visual:   { icon: '◲', cssClass: 'kind-visual',   label: 'Visual' },
        page:     { icon: '☰', cssClass: 'kind-page',     label: 'Page' }
    };

    function getKindMeta(kind) {
        return KIND_META[kind] || { icon: '?', cssClass: '', label: kind };
    }

    // ── Debounce ────────────────────────────────────────────────
    var debounceTimer = null;
    function debounce(fn, delay) {
        return function () {
            var args = arguments;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(function () { fn.apply(null, args); }, delay);
        };
    }

    // ── Render Helpers ──────────────────────────────────────────

    function createMetricCard(value, label, kind) {
        var card = document.createElement('div');
        card.className = 'metric-card fade-in';
        if (activeCategoryFilter === kind) {
            card.classList.add('active');
        }

        var valEl = document.createElement('div');
        valEl.className = 'metric-value';
        valEl.textContent = value;

        var lblEl = document.createElement('div');
        lblEl.className = 'metric-label';
        lblEl.textContent = label;

        card.appendChild(valEl);
        card.appendChild(lblEl);

        card.addEventListener('click', function () {
            if (activeCategoryFilter === kind) {
                activeCategoryFilter = null;
                card.classList.remove('active');
                searchInput.placeholder = "Search measure, table or visual...";
            } else {
                var cards = metricsGrid.querySelectorAll('.metric-card');
                cards.forEach(function (c) { c.classList.remove('active'); });

                activeCategoryFilter = kind;
                card.classList.add('active');
                searchInput.placeholder = "Search in " + label + "...";
            }
            handleSearchInput();
            searchInput.focus();
        });

        return card;
    }

    function renderMetrics(data) {
        // Project Context
        var projectNameEl = document.getElementById('project-name');
        if (projectNameEl && data.projectName) {
            projectNameEl.textContent = data.projectName;
        }

        // Metrics Grid
        metricsGrid.innerHTML = '';
        metricsGrid.appendChild(createMetricCard(data.totalMeasures, 'Measures', 'measure'));
        metricsGrid.appendChild(createMetricCard(data.totalColumns, 'Columns', 'column'));
        metricsGrid.appendChild(createMetricCard(data.totalTables, 'Tables', 'table'));
        metricsGrid.appendChild(createMetricCard(data.totalVisuals, 'Visuals', 'visual'));

        // Health Score
        var donutEl = document.getElementById('health-donut');
        var scoreTextEl = document.getElementById('health-score-text');
        var orphansTextEl = document.getElementById('health-orphans-text');

        if (donutEl && scoreTextEl && orphansTextEl) {
            var score = data.healthScore !== undefined ? data.healthScore : 100;
            scoreTextEl.textContent = score;
            orphansTextEl.textContent = (data.totalOrphanMeasures || 0) + ' orphan measures';

            // Colorimetry
            var color = '#10b981'; // Green for healthy (> 80)
            if (score < 50) {
                color = '#ef4444'; // Red for high risk/orphan (< 50)
            } else if (score <= 80) {
                color = '#f97316'; // Orange for warning (50-80)
            }

            var deg = Math.round((score / 100) * 360) + 'deg';
            donutEl.style.setProperty('--health-color', color);
            donutEl.style.setProperty('--health-deg', deg);
        }

        // Usage Breakdown
        var totalMeasures = data.totalMeasures || 0;
        var totalOrphanMeasures = data.totalOrphanMeasures || 0;
        var activeMeasures = Math.max(0, totalMeasures - totalOrphanMeasures);
        
        var usageTextEl = document.getElementById('usage-text');
        var usageBarEl = document.getElementById('usage-bar');

        if (usageTextEl && usageBarEl) {
            var percentage = totalMeasures > 0 ? Math.round((activeMeasures / totalMeasures) * 100) : 0;
            usageTextEl.textContent = activeMeasures + ' / ' + totalMeasures + ' (' + percentage + '%)';
            usageBarEl.style.width = percentage + '%';
            
            if (percentage < 50) {
                usageBarEl.style.backgroundColor = '#ef4444';
            } else if (percentage < 80) {
                usageBarEl.style.backgroundColor = '#f97316';
            } else {
                usageBarEl.style.backgroundColor = '#10b981';
            }
        }

        emptyState.style.display = 'none';
        dashboard.style.display = 'block';

        statusBadge.className = 'status-badge ready';
        statusText.textContent = 'Model loaded';

        // Automatically trigger orphan measures analysis
        vscode.postMessage({ command: 'getOrphans' });
    }

    function showLoading() {
        statusBadge.className = 'status-badge loading';
        statusText.textContent = 'Updating...';
    }

    function showError(msg) {
        statusBadge.className = 'status-badge error';
        statusText.textContent = 'Error: ' + msg;
    }

    function requestMetrics() {
        vscode.postMessage({ command: 'getMetrics' });
    }

    // ── Search ──────────────────────────────────────────────────

    function handleSearchInput() {
        var query = searchInput.value.trim();
        if (query.length < 2 && !activeCategoryFilter) {
            searchResults.innerHTML = '';
            return;
        }
        vscode.postMessage({ command: 'searchNodes', query: query, limit: 100 });
    }

    function renderSearchResults(nodes) {
        searchResults.innerHTML = '';
        var filteredNodes = nodes || [];
        if (activeCategoryFilter) {
            filteredNodes = filteredNodes.filter(function (node) {
                return node.kind === activeCategoryFilter;
            });
        }

        if (filteredNodes.length === 0) {
            searchResults.innerHTML = '<div class="lineage-empty">No results found</div>';
            return;
        }

        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            var meta = getKindMeta(node.kind);

            var item = document.createElement('div');
            item.className = 'search-result-item fade-in';
            item.setAttribute('data-id', node.id);

            var icon = document.createElement('div');
            icon.className = 'search-result-icon ' + meta.cssClass;
            icon.textContent = meta.icon;

            var name = document.createElement('div');
            name.className = 'search-result-name';
            name.textContent = node.name;
            name.title = node.qualifiedName;

            var kind = document.createElement('div');
            kind.className = 'search-result-kind';
            kind.textContent = meta.label;

            item.appendChild(icon);
            item.appendChild(name);
            item.appendChild(kind);

            // Click handler via closure (Send openNodeDetails IPC instead of local lineage)
            (function (nodeId) {
                item.addEventListener('click', function () {
                    vscode.postMessage({ command: 'openNodeDetails', nodeId: nodeId });
                    searchResults.innerHTML = '';
                    searchInput.value = '';
                });
            })(node.id);

            searchResults.appendChild(item);
        }
    }

    // ── Lineage Renderer ────────────────────────────────────────

    function createNodeCard(nodeDto, isCenter) {
        var meta = getKindMeta(nodeDto.kind);

        var card = document.createElement('div');
        card.className = 'lineage-node-card fade-in' + (isCenter ? ' center-card' : '');

        var icon = document.createElement('div');
        icon.className = 'lineage-node-icon ' + meta.cssClass;
        icon.textContent = meta.icon;

        var info = document.createElement('div');
        info.className = 'lineage-node-info';

        var name = document.createElement('div');
        name.className = 'lineage-node-name';
        name.textContent = nodeDto.name;

        var qualified = document.createElement('div');
        qualified.className = 'lineage-node-qualified';
        qualified.textContent = nodeDto.qualifiedName;

        info.appendChild(name);
        info.appendChild(qualified);
        card.appendChild(icon);
        card.appendChild(info);
        return card;
    }

    function renderLineage(data) {
        if (!data || !data.node) {
            lineageView.style.display = 'none';
            return;
        }

        // Clear all columns
        usedByList.innerHTML = '';
        centerNode.innerHTML = '';
        dependsOnList.innerHTML = '';

        // Center node
        centerNode.appendChild(createNodeCard(data.node, true));

        // Used By (reverse edges: who depends on THIS node)
        if (data.usedBy.length === 0) {
            usedByList.innerHTML = '<div class="lineage-empty">None</div>';
        } else {
            for (var i = 0; i < data.usedBy.length; i++) {
                var edge = data.usedBy[i];
                var relNode = data.relatedNodes[edge.sourceId];
                if (relNode) {
                    usedByList.appendChild(createNodeCard(relNode, false));
                }
            }
        }

        // Depends On (forward edges: what THIS node depends on)
        if (data.directDependencies.length === 0) {
            dependsOnList.innerHTML = '<div class="lineage-empty">None</div>';
        } else {
            for (var j = 0; j < data.directDependencies.length; j++) {
                var depEdge = data.directDependencies[j];
                var depNode = data.relatedNodes[depEdge.targetId];
                if (depNode) {
                    dependsOnList.appendChild(createNodeCard(depNode, false));
                }
            }
        }

        lineageView.style.display = 'grid';
    }

    // ── Orphan Renderer ─────────────────────────────────────────

    function renderOrphans(nodes) {
        orphanResults.innerHTML = '';

        // Count header
        var countDiv = document.createElement('div');
        countDiv.className = 'orphan-count' + (nodes.length === 0 ? ' clean' : '');
        countDiv.innerHTML = '<span class="count-value">' + nodes.length + '</span> orphan node(s) detected';
        orphanResults.appendChild(countDiv);

        if (nodes.length === 0) { return; }

        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            var meta = getKindMeta(node.kind);

            var item = document.createElement('div');
            item.className = 'search-result-item fade-in';

            var icon = document.createElement('div');
            icon.className = 'search-result-icon ' + meta.cssClass;
            icon.textContent = meta.icon;

            var name = document.createElement('div');
            name.className = 'search-result-name';
            name.textContent = node.name;
            name.title = node.qualifiedName;

            var kind = document.createElement('div');
            kind.className = 'search-result-kind';
            kind.textContent = meta.label;

            item.appendChild(icon);
            item.appendChild(name);
            item.appendChild(kind);

            // Click to inspect details
            (function (nodeId) {
                item.addEventListener('click', function () {
                    vscode.postMessage({ command: 'openNodeDetails', nodeId: nodeId });
                });
            })(node.id);

            orphanResults.appendChild(item);
        }
    }

    // ── IPC: Listen for Backend Messages ────────────────────────
    window.addEventListener('message', function (event) {
        var msg = event.data;

        switch (msg.command) {
            case 'metricsData':
                renderMetrics(msg.data);
                break;

            case 'stateUpdated':
                showLoading();
                if (refreshBtn) {
                    refreshBtn.classList.remove('spinning');
                }
                lineageView.style.display = 'none';
                searchInput.value = '';
                searchResults.innerHTML = '';
                requestMetrics();
                break;

            case 'searchResultData':
                renderSearchResults(msg.data);
                break;

            case 'nodeLineageData':
                renderLineage(msg.data);
                break;

            case 'analysisFailed':
                if (refreshBtn) {
                    refreshBtn.classList.remove('spinning');
                }
                showError(msg.error || 'Unknown error');
                break;

            case 'orphansData':
                renderOrphans(msg.data);
                break;
        }
    });

    // ── Event Bindings ──────────────────────────────────────────
    searchInput.addEventListener('input', debounce(handleSearchInput, 250));
    if (orphanBtn) {
        orphanBtn.addEventListener('click', function () {
            orphanResults.innerHTML = '<div class="lineage-empty">Analyzing...</div>';
            vscode.postMessage({ command: 'getOrphans' });
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', function () {
            if (refreshBtn.classList.contains('spinning')) return;
            refreshBtn.classList.add('spinning');
            vscode.postMessage({ command: 'refreshProject' });
        });
    }

    document.addEventListener('click', function (event) {
        var isClickInsideSearch = searchInput.contains(event.target) || searchResults.contains(event.target);
        if (!isClickInsideSearch) {
            searchResults.innerHTML = '';
        }
    });

    // ── Bootstrap ───────────────────────────────────────────────
    requestMetrics();
})();
