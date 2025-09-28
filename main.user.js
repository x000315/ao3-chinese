// ==UserScript==
// @name         AO3 汉化插件
// @namespace    https://github.com/V-Lipset/ao3-chinese
// @description  中文化 AO3 界面，可调用 AI 实现简介、注释、评论以及全文翻译。
// @version      1.5.3-2025-09-28
// @author       V-Lipset
// @license      GPL-3.0
// @match        https://archiveofourown.org/*
// @match        https://xn--iao3-lw4b.ws/*
// @match        https://ao3sg.hyf9588.tech/*
// @icon         https://raw.githubusercontent.com/V-Lipset/ao3-chinese/main/assets/icon.png
// @resource     vIcon https://cdn.jsdelivr.net/gh/V-Lipset/ao3-chinese@main/assets/icon.png
// @supportURL   https://github.com/V-Lipset/ao3-chinese/issues
// @downloadURL  https://raw.githubusercontent.com/V-Lipset/ao3-chinese/main/main.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/V-Lipset/ao3-chinese@main/main.user.js
// @require      https://raw.githubusercontent.com/V-Lipset/ao3-chinese/main/zh-cn.js
// @connect      raw.githubusercontent.com
// @connect      cdn.jsdelivr.net
// @connect      translate.googleapis.com
// @connect      translate-pa.googleapis.com
// @connect      api.openai.com
// @connect      api.anthropic.com
// @connect      open.bigmodel.cn
// @connect      api.deepseek.com
// @connect      generativelanguage.googleapis.com
// @connect      api.groq.com
// @connect      api.together.xyz
// @connect      api.cerebras.ai
// @connect      api-inference.modelscope.cn
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_notification
// @grant        GM_addStyle
// @grant        GM_getResourceURL
// ==/UserScript==

(function (window, document, undefined) {
    'use strict';
    /****************** 全局配置区 ******************/

    // 调试模式开关
    const DEBUG_MODE = false;

    // 功能开关
    const FeatureSet = {
        enable_RegExp: GM_getValue('enable_RegExp', true),
        enable_transDesc: GM_getValue('enable_transDesc', false),
    };

    // 自定义服务存储键
    const CUSTOM_SERVICES_LIST_KEY = 'custom_services_list';
    const ACTIVE_MODEL_PREFIX_KEY = 'active_model_for_';
    const ADD_NEW_CUSTOM_SERVICE_ID = 'add_new_custom';

    // AI 翻译指令
    const sharedSystemPrompt = `You are a professional translator fluent in Simplified Chinese (简体中文), with particular expertise in translating web novels and online fanfiction.

    Your task is to translate a numbered list of text segments provided by the user. These segments can be anything from full paragraphs to single phrases or words. For each numbered item, you will follow an internal three-stage strategy to produce the final, polished translation.

    ### Internal Translation Strategy (for each item):
    1.  **Stage 1 (Internal Thought Process):** Produce a literal, word-for-word translation of the English content.
    2.  **Stage 2 (Internal Thought Process):** Based on the literal translation, identify any phrasing that is unnatural or does not flow well in Chinese.
    3.  **Stage 3 (Final Output):** Produce a polished, idiomatic translation that fully preserves the original meaning, tone, cultural nuances, and any specialized fandom terminology. The final translation must be natural-sounding, readable, and conform to standard Chinese usage.

    ### CRITICAL OUTPUT INSTRUCTIONS:
    - Your entire response MUST consist of *only* the polished Chinese translation from Stage 3, formatted as a numbered list that exactly matches the input's numbering.
    - Do NOT include any stage numbers, headers (e.g., "Polished Translation"), notes, or explanations in your final output.
    - **HTML Tag Preservation:** If an item contains HTML tags (e.g., \`<em>\`, \`<strong>\`), you MUST preserve these tags exactly as they are in the original, including their positions around the translated text.
    - **Placeholder Preservation:** If an item contains special placeholders in the format \`ph_\` followed by six digits (e.g., \`ph_123456\`), you MUST preserve these placeholders exactly as they are. DO NOT translate, modify, add spaces to, delete, or alter them in any way.
    - **Untranslatable Content:** If an item is a separator, a meaningless symbol, or otherwise untranslatable, you MUST return the original item exactly as it is, preserving its number.

    ### Example Input:
    1. This is the <em>first</em> sentence.
    2. ---
    3. Her name is ph_123456.
    4. This is the fourth sentence.

    ### Example Output:
    1. 这是<em>第一个</em>句子。
    2. ---
    3. 她的名字是 ph_123456。
    4. 这是第四个句子。
    `;

    // AI 请求数据构建
    const createRequestData = (model, systemPrompt, paragraphs) => {
        const numberedText = paragraphs
            .map((p, i) => `${i + 1}. ${p.innerHTML}`)
            .join('\n\n');
        return {
            model: model,
            messages: [
                { "role": "system", "content": systemPrompt },
                { "role": "user", "content": `Translate the following numbered list to Simplified Chinese（简体中文）:\n\n${numberedText}` }
            ],
            stream: false,
            temperature: 1.0,
        };
    };

    // 创建一个标准的、兼容OpenAI API的服务配置对象
    const createStandardApiConfig = ({ name, url }) => ({
        name: name,
        url_api: url,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        getRequestData: (paragraphs, engineName) => {
            const model = getCurrentModelId(engineName);
            return createRequestData(
                model,
                sharedSystemPrompt,
                paragraphs
            );
        },
        responseIdentifier: 'choices[0].message.content',
    });

    // 底层实现配置
    const CONFIG = {
        LANG: 'zh-CN',
        PAGE_MAP: { 'archiveofourown.org': 'ao3' },
        SPECIAL_SITES: [],
        OBSERVER_CONFIG: {
            childList: true,
            subtree: true,
            characterData: true,
            attributeFilter: ['value', 'placeholder', 'aria-label', 'data-confirm', 'title']
        },

        // 默认及储存翻译服务
        transEngine: GM_getValue('transEngine', 'google_translate'),

        // 默认文本分块、懒加载边距
		CHUNK_SIZE: 1600,
        PARAGRAPH_LIMIT: 8,
		SUBSEQUENT_CHUNK_SIZE: 2400,
        SUBSEQUENT_PARAGRAPH_LIMIT: 12,
        LAZY_LOAD_ROOT_MARGIN: '400px 0px 1000px 0px',

        // 特殊引擎/模型分块、懒加载
        MODEL_SPECIFIC_LIMITS: {
            'google_translate': {
                first: {
                    CHUNK_SIZE: 4000,
                    PARAGRAPH_LIMIT: 20,
                },
                subsequent: {
                    CHUNK_SIZE: 5000,
                    PARAGRAPH_LIMIT: 25,
                },
                LAZY_LOAD_ROOT_MARGIN: '1200px 0px 3000px 0px',
            },
            'gemini-2.5-pro': {
                first: {
                    CHUNK_SIZE: 2400,
                    PARAGRAPH_LIMIT: 12,
                },
                subsequent: {
                    CHUNK_SIZE: 3000,
                    PARAGRAPH_LIMIT: 15,
                }
            },
            'deepseek-reasoner': {
                first: {
                    CHUNK_SIZE: 2400,
                    PARAGRAPH_LIMIT: 12,
                },
                subsequent: {
                    CHUNK_SIZE: 3000,
                    PARAGRAPH_LIMIT: 15,
                }
            }
        },

        // 占位符校验阈值
        VALIDATION_THRESHOLDS: {
            absolute_loss: {
                google_translate: 4,
                default: 5,
            },
            proportional_loss: 0.8,
            proportional_trigger_count: 5,
        },

        // 翻译服务配置
        TRANS_ENGINES: {
            google_translate: {
                name: '谷歌翻译',
                url_api: 'https://translate-pa.googleapis.com/v1/translateHtml',
                method: 'POST',
                headers: { 'Content-Type': 'application/json+protobuf' },
                getRequestData: (paragraphs) => {
                    const sourceTexts = paragraphs.map(p => p.outerHTML);
                    return JSON.stringify([
                        [sourceTexts, "auto", "zh-CN"], "te"
                    ]);
                },
            },
            openai: {
                name: 'OpenAI',
                url_api: 'https://api.openai.com/v1/chat/completions',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                getRequestData: () => ({}),
            },
            anthropic: {
                name: 'Anthropic',
                url_api: 'https://api.anthropic.com/v1/messages',
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
                getRequestData: () => ({}),
            },
            zhipu_ai: createStandardApiConfig({
                name: 'Zhipu AI',
                url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
                modelGmKey: null,
                defaultModel: 'glm-4-flash-250414'
            }),
            deepseek_ai: createStandardApiConfig({
                name: 'DeepSeek',
                url: 'https://api.deepseek.com/chat/completions',
                modelGmKey: 'deepseek_model',
                defaultModel: 'deepseek-chat'
            }),
            google_ai: {
                name: 'Google AI',
                url_api: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                getRequestData: (paragraphs) => {
                    const numberedText = paragraphs
                        .map((p, i) => `${i + 1}. ${p.innerHTML}`)
                        .join('\n\n');

                    const userPrompt = `Translate the following numbered list to Simplified Chinese（简体中文）:\n\n${numberedText}`;

                    return {
                        systemInstruction: {
                            role: "user",
                            parts: [{ text: sharedSystemPrompt }]
                        },
                        contents: [{
                            role: "user",
                            parts: [{ text: userPrompt }]
                        }],
                        generationConfig: {
                            temperature: 1.0,
                            candidateCount: 1,
                            thinkingConfig: {
                                thinkingBudget: -1
                            }
                        }
                    };
                },
                responseIdentifier: 'candidates[0].content.parts[0].text',
            },
            groq_ai: createStandardApiConfig({
                name: 'Groq AI',
                url: 'https://api.groq.com/openai/v1/chat/completions',
                modelGmKey: 'groq_model',
                defaultModel: 'meta-llama/llama-4-maverick-17b-128e-instruct'
            }),
            together_ai: createStandardApiConfig({
                name: 'Together AI',
                url: 'https://api.together.xyz/v1/chat/completions',
                modelGmKey: 'together_model',
                defaultModel: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8'
            }),
            cerebras_ai: createStandardApiConfig({
                name: 'Cerebras',
                url: 'https://api.cerebras.ai/v1/chat/completions',
                modelGmKey: 'cerebras_model',
                defaultModel: 'llama-4-scout-17b-16e-instruct'
            }),
            modelscope_ai: createStandardApiConfig({
                name: 'ModelScope',
                url: 'https://api-inference.modelscope.cn/v1/chat/completions',
                modelGmKey: 'modelscope_model',
                defaultModel: 'LLM-Research/Llama-4-Maverick-17B-128E-Instruct'
            }),
        }
    };

    // 标记是否为首次翻译区块
    let isFirstTranslationChunk = true;
    // 页面配置缓存
    let pageConfig = {};

    /**
     * 菜单渲染函数
     */
    function setupMenuCommands(fabLogic, panelLogic) {
        let menuCommandIds = [];
        const render = () => {
            menuCommandIds.forEach(id => GM_unregisterMenuCommand(id));
            menuCommandIds = [];

            const register = (text, callback) => {
                menuCommandIds.push(GM_registerMenuCommand(text, callback));
            };

            const showFab = GM_getValue('show_fab', true);
            register(showFab ? '隐藏悬浮球' : '显示悬浮球', () => {
                const newState = !showFab;
                GM_setValue('show_fab', newState);
                fabLogic.toggleFabVisibility();
                render();
            });

            const isPanelOpen = panelLogic.panel.style.display === 'block';
            const panelToggleText = isPanelOpen ? '关闭设置面板' : '打开设置面板';
            register(panelToggleText, () => {
                panelLogic.togglePanel();
            });
        };
        return render;
    }

    /**
     * 悬浮球的结构与样式
     */
    function createFabUI() {
        const iconUrl = GM_getResourceURL('vIcon');

        GM_addStyle(`
            #ao3-trans-fab-container {
                position: fixed;
                top: 0;
                left: 0;
                z-index: 2147483646;
                touch-action: none;
                cursor: grab;
                user-select: none;
            }
            #ao3-trans-fab-container.dragging {
                cursor: grabbing;
            }
            #ao3-trans-fab {
                width: 42px;
                height: 42px;
                border-radius: 50%;
                background-color: #990000;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                transition: all 0.3s ease;
            }
            #ao3-trans-fab-container.snapped:not(.is-active) #ao3-trans-fab {
                opacity: 0.3;
            }
            #ao3-trans-fab-container:hover #ao3-trans-fab {
                transform: scale(1.05);
                box-shadow: 0 6px 16px rgba(0, 0, 0, 0.25);
            }
            .fab-icon {
                width: 26px;
                height: 26px;
                background-image: url(${iconUrl});
                background-size: contain;
                background-repeat: no-repeat;
                background-position: center;
                filter: brightness(0) invert(1);
            }
        `);

        const fabContainer = document.createElement('div');
        fabContainer.id = 'ao3-trans-fab-container';

        const fabButton = document.createElement('div');
        fabButton.id = 'ao3-trans-fab';

        const settingsIcon = document.createElement('div');
        settingsIcon.className = 'fab-icon';

        fabButton.appendChild(settingsIcon);
        fabContainer.appendChild(fabButton);
        document.body.appendChild(fabContainer);

        return { fabContainer };
    }

    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };

    /**
     * 悬浮球的交互事件
     */
    function initializeFabInteraction(fabElements, panelLogic) {
        const { fabContainer } = fabElements;
        const FAB_POSITION_KEY = 'ao3_fab_position';
        const DRAG_THRESHOLD = 5;
        const SAFE_MARGIN = 16;
		const RETRACT_MARGIN = 10;
        const SNAP_THRESHOLD = 40;

        let isPointerDown = false;
        let isDragging = false;
        let startCoords = { x: 0, y: 0 };
        let startPosition = { x: 0, y: 0 };
        let fabSize = { width: 0, height: 0 };
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        const limitNumber = (num, min, max) => Math.max(min, Math.min(num, max));

        const savePosition = debounce((pos) => GM_setValue(FAB_POSITION_KEY, pos), 500);

        const updateFabSize = () => {
            const rect = fabContainer.getBoundingClientRect();
            fabSize = { width: rect.width, height: rect.height };
        };

        const setPosition = (pos, useTransition = false) => {
            fabContainer.style.transition = useTransition ? 'all 0.3s ease' : 'none';
            fabContainer.style.left = `${pos.x}px`;
            fabContainer.style.top = `${pos.y}px`;
        };

        const snapDecision = (forceRetract = false) => {
            if (isDragging) return;
            window.removeEventListener('mousemove', checkMouseLeave);

            const winW = document.documentElement.clientWidth;
            const winH = window.innerHeight;
            const currentPos = { x: parseFloat(fabContainer.style.left || 0), y: parseFloat(fabContainer.style.top || 0) };

            const dist = {
                left: currentPos.x,
                right: winW - (currentPos.x + fabSize.width),
                top: currentPos.y,
                bottom: winH - (currentPos.y + fabSize.height)
            };

            const isNearLeft = dist.left < SNAP_THRESHOLD;
            const isNearRight = dist.right < SNAP_THRESHOLD;
            const isNearTop = dist.top < SNAP_THRESHOLD;
            const isNearBottom = dist.bottom < SNAP_THRESHOLD;

            let finalPos = { ...currentPos };
            let shouldSnap = true;

            if ((isNearLeft && isNearTop) || (isNearLeft && isNearBottom) || (isNearRight && isNearTop) || (isNearRight && isNearBottom)) {
                finalPos.x = isNearLeft ? SAFE_MARGIN : winW - fabSize.width - SAFE_MARGIN;
                finalPos.y = isNearTop ? SAFE_MARGIN : winH - fabSize.height - SAFE_MARGIN;
                fabContainer.classList.remove('snapped', 'is-active');
            } else if (isNearLeft || isNearRight || isNearTop || isNearBottom) {
                const minVertical = Math.min(dist.top, dist.bottom);
                const minHorizontal = Math.min(dist.left, dist.right);

                if (minHorizontal < minVertical) {
                    finalPos.x = isNearLeft ? -fabSize.width / 2 : winW - fabSize.width / 2;
                } else {
                    finalPos.y = isNearTop ? -fabSize.height / 2 : winH - fabSize.height / 2;
                }
                fabContainer.classList.add('snapped');
                fabContainer.classList.remove('is-active');
            } else {
                shouldSnap = false;
                fabContainer.classList.remove('snapped', 'is-active');
            }

            if (shouldSnap || forceRetract) {
                setPosition(finalPos, true);
                savePosition(finalPos);
            }
        };

        const activateFab = () => {
            if (isDragging || !fabContainer.classList.contains('snapped')) return;

            window.removeEventListener('mousemove', checkMouseLeave);
            fabContainer.classList.add('is-active');

            const winW = document.documentElement.clientWidth;
            const winH = window.innerHeight;
            const currentPos = { x: parseFloat(fabContainer.style.left), y: parseFloat(fabContainer.style.top) };
            let newPos = { ...currentPos };

			if (currentPos.x < 0) newPos.x = RETRACT_MARGIN;
			else if (currentPos.x > winW - fabSize.width) newPos.x = winW - fabSize.width - RETRACT_MARGIN;

			if (currentPos.y < 0) newPos.y = RETRACT_MARGIN;
			else if (currentPos.y > winH - fabSize.height) newPos.y = winH - fabSize.height - RETRACT_MARGIN;

			setPosition(newPos, true);
        };

        const onPointerDown = (e) => {
            if (e.button !== 0 && e.pointerType !== 'touch') return;
            fabContainer.setPointerCapture(e.pointerId);
            isPointerDown = true;
            isDragging = false;
            startCoords = { x: e.clientX, y: e.clientY };
            startPosition = { x: parseFloat(fabContainer.style.left || 0), y: parseFloat(fabContainer.style.top || 0) };
            fabContainer.style.transition = 'none';
        };

        const onPointerMove = (e) => {
            if (!isPointerDown) return;
            const dx = e.clientX - startCoords.x;
            const dy = e.clientY - startCoords.y;

            if (!isDragging && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
                isDragging = true;
                fabContainer.classList.add('dragging');
                fabContainer.classList.remove('snapped', 'is-active');
            }

            if (isDragging) {
                const newX = startPosition.x + dx;
                const newY = startPosition.y + dy;
                setPosition({ x: newX, y: newY });
            }
        };

        const onPointerUp = (e) => {
            if (!isPointerDown) return;
            fabContainer.releasePointerCapture(e.pointerId);
            isPointerDown = false;

            if (isDragging) {
                isDragging = false;
                fabContainer.classList.remove('dragging');

                const winW = document.documentElement.clientWidth;
                const winH = window.innerHeight;
                let finalPos = { x: parseFloat(fabContainer.style.left), y: parseFloat(fabContainer.style.top) };
                finalPos.x = limitNumber(finalPos.x, 0, winW - fabSize.width);
                finalPos.y = limitNumber(finalPos.y, 0, winH - fabSize.height);
                setPosition(finalPos);
                savePosition(finalPos);

                snapDecision();
            } else {
                if (fabContainer.classList.contains('snapped') && !fabContainer.classList.contains('is-active')) {
                    activateFab();
                }
                panelLogic.togglePanel();
            }
        };

        const checkMouseLeave = (e) => {
            const rect = fabContainer.getBoundingClientRect();
            const extendedRect = {
                left: rect.left - SAFE_MARGIN, top: rect.top - SAFE_MARGIN,
                right: rect.right + SAFE_MARGIN, bottom: rect.bottom + SAFE_MARGIN
            };
            if (e.clientX < extendedRect.left || e.clientX > extendedRect.right || e.clientY < extendedRect.top || e.clientY > extendedRect.bottom) {
                if (panelLogic.panel.style.display !== 'block') {
                    snapDecision(true);
                }
            }
        };

        const onResize = debounce(() => {
            updateFabSize();
            snapDecision(true);
        }, 200);

        fabContainer.addEventListener('pointerdown', onPointerDown);
        fabContainer.addEventListener('pointermove', onPointerMove);
        fabContainer.addEventListener('pointerup', onPointerUp);
        fabContainer.addEventListener('contextmenu', (e) => { e.preventDefault(); panelLogic.togglePanel(); });

        if (!isTouchDevice) {
            fabContainer.addEventListener('mouseenter', activateFab);
            fabContainer.addEventListener('mouseleave', () => {
                if (panelLogic.panel.style.display !== 'block') {
                    window.addEventListener('mousemove', checkMouseLeave);
                }
            });
        }

        window.addEventListener('resize', onResize);

        const initializePosition = () => {
            updateFabSize();
            let initialPosition = GM_getValue(FAB_POSITION_KEY);
            if (!initialPosition) {
                const winW = document.documentElement.clientWidth;
                const winH = window.innerHeight;
                initialPosition = {
                    x: winW - fabSize.width / 2,
                    y: winH * 0.75 - fabSize.height / 2
                };
            }
            setPosition(initialPosition);
            setTimeout(() => snapDecision(true), 100);
        };

        initializePosition();

        return {
            toggleFabVisibility: () => {
                const showFab = GM_getValue('show_fab', true);
                fabContainer.style.display = showFab ? 'block' : 'none';
            },
            retractFab: () => snapDecision(true)
        };
    }

    /**
     * 聚合所有用户配置和数据以供导出
     */
    async function exportAllData() {
        const allData = {
            metadata: {
                exportFormatVersion: "1.0",
                scriptVersion: GM_info.script.version,
                exportDate: getShanghaiTimeString(),
            },
            data: {
                staticKeys: {},
                apiKeys: {},
                modelSelections: {},
                customServices: [],
                glossaries: {},
                uiState: {}
            }
        };

        const staticKeys = [
            'enable_RegExp', 'enable_transDesc', 'show_fab', 'transEngine',
            'translation_display_mode', 'ao3_glossary_last_action'
        ];
        for (const key of staticKeys) {
            allData.data.staticKeys[key] = GM_getValue(key);
        }

        const builtInServices = Object.keys(engineMenuConfig).filter(id => id !== 'google_translate' && id !== 'add_new_custom');
        for (const serviceId of builtInServices) {
            allData.data.apiKeys[`${serviceId}_keys_string`] = GM_getValue(`${serviceId}_keys_string`);
            if (engineMenuConfig[serviceId].modelGmKey) {
                allData.data.modelSelections[engineMenuConfig[serviceId].modelGmKey] = GM_getValue(engineMenuConfig[serviceId].modelGmKey);
            }
        }

        const customServicesList = GM_getValue(CUSTOM_SERVICES_LIST_KEY, []);
        for (const service of customServicesList) {
            allData.data.customServices.push({
                id: service.id,
                name: service.name,
                url: service.url,
                apiKey: GM_getValue(`${service.id}_keys_string`),
                modelsRaw: service.modelsRaw,
                selectedModel: GM_getValue(`${ACTIVE_MODEL_PREFIX_KEY}${service.id}`),
                lastAction: GM_getValue(`custom_service_last_action_${service.id}`)
            });
        }

        allData.data.glossaries = {
            local: GM_getValue(LOCAL_GLOSSARY_STRING_KEY),
            forbidden: GM_getValue(LOCAL_FORBIDDEN_STRING_KEY),
            postReplace: GM_getValue(POST_REPLACE_STRING_KEY),
            onlineMetadata: GM_getValue(GLOSSARY_METADATA_KEY),
            lastSelectedOnline: GM_getValue(LAST_SELECTED_GLOSSARY_KEY)
        };

        allData.data.uiState = {
            fabPosition: GM_getValue('ao3_fab_position'),
            panelPosition: GM_getValue('ao3_panel_position')
        };

        return allData;
    }

    /**
     * 校验并导入用户配置数据，并自动同步在线术语表
     */
    async function importAllData(jsonData, syncPanelStateCallback) {
        if (!jsonData || !jsonData.metadata || !jsonData.data || jsonData.metadata.exportFormatVersion !== "1.0") {
            return { success: false, message: "文件格式无效或版本不兼容。" };
        }

        const { data } = jsonData;

        if (data.staticKeys) {
            for (const [key, value] of Object.entries(data.staticKeys)) {
                if (value !== undefined) GM_setValue(key, value);
            }
        }

        if (data.apiKeys) {
            for (const [key, value] of Object.entries(data.apiKeys)) {
                if (value !== undefined) {
                    GM_setValue(key, value);
                }
            }
        }
        if (data.modelSelections) {
            for (const [key, value] of Object.entries(data.modelSelections)) {
                if (value !== undefined) GM_setValue(key, value);
            }
        }

        if (data.customServices && Array.isArray(data.customServices)) {
            const oldServices = GM_getValue(CUSTOM_SERVICES_LIST_KEY, []);
            oldServices.forEach(s => {
                GM_deleteValue(`${s.id}_keys_string`);
                GM_deleteValue(`${s.id}_keys_array`);
                GM_deleteValue(`${ACTIVE_MODEL_PREFIX_KEY}${s.id}`);
                GM_deleteValue(`custom_service_last_action_${s.id}`);
            });

            const newServiceList = [];
            for (const service of data.customServices) {
                newServiceList.push({
                    id: service.id,
                    name: service.name,
                    url: service.url,
                    modelsRaw: service.modelsRaw,
                    models: String(service.modelsRaw).replace(/[，]/g, ',').split(',').map(m => m.trim()).filter(Boolean)
                });
                GM_setValue(`${service.id}_keys_string`, service.apiKey);
                GM_setValue(`${ACTIVE_MODEL_PREFIX_KEY}${service.id}`, service.selectedModel);
                GM_setValue(`custom_service_last_action_${service.id}`, service.lastAction);
            }
            GM_setValue(CUSTOM_SERVICES_LIST_KEY, newServiceList);
        }

        if (data.glossaries) {
            const { local, forbidden, postReplace, onlineMetadata, lastSelectedOnline } = data.glossaries;
            if (local !== undefined) GM_setValue(LOCAL_GLOSSARY_STRING_KEY, local);
            if (forbidden !== undefined) GM_setValue(LOCAL_FORBIDDEN_STRING_KEY, forbidden);
            if (postReplace !== undefined) GM_setValue(POST_REPLACE_STRING_KEY, postReplace);
            if (onlineMetadata !== undefined) GM_setValue(GLOSSARY_METADATA_KEY, onlineMetadata);
            if (lastSelectedOnline !== undefined) GM_setValue(LAST_SELECTED_GLOSSARY_KEY, lastSelectedOnline);
        }

        if (data.uiState) {
            if (data.uiState.fabPosition) GM_setValue('ao3_fab_position', data.uiState.fabPosition);
            if (data.uiState.panelPosition) GM_setValue('ao3_panel_position', data.uiState.panelPosition);
        }

        synchronizeAllSettings(syncPanelStateCallback);

        let syncSummary = "";
        const onlineMetadata = data.glossaries?.onlineMetadata;
        if (onlineMetadata && typeof onlineMetadata === 'object' && Object.keys(onlineMetadata).length > 0) {
            const downloadPromises = Object.keys(onlineMetadata).map(url => importOnlineGlossary(url, { silent: true }));
            const results = await Promise.allSettled(downloadPromises);

            const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
            const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));

            syncSummary = `在线术语表同步完成：${successful.length} 个成功`;
            if (failed.length > 0) {
                syncSummary += `，${failed.length} 个失败。`;
                console.error("以下术语表同步失败:", failed.map(r => r.status === 'fulfilled' ? r.value : r.reason));
            }
        }

        const finalMessage = "配置已成功导入！" + (syncSummary ? `\n${syncSummary}` : "");
        return { success: true, message: finalMessage };
    }

    /**
     * 同步函数，用于在设置变更后激活所有数据和状态
     */
    function synchronizeAllSettings(syncPanelStateCallback) {
        const postReplaceRaw = GM_getValue(POST_REPLACE_STRING_KEY, '');
        processAndSavePostReplaceRules(postReplaceRaw);

        const forbiddenRaw = GM_getValue(LOCAL_FORBIDDEN_STRING_KEY, '');
        const forbiddenArray = forbiddenRaw.split(/[，,]/).map(t => t.trim()).filter(Boolean);
        GM_setValue(LOCAL_FORBIDDEN_TERMS_KEY, forbiddenArray);

        const allServiceIds = [
            ...Object.keys(engineMenuConfig),
            ...GM_getValue(CUSTOM_SERVICES_LIST_KEY, []).map(s => s.id)
        ];
        for (const serviceId of new Set(allServiceIds)) {
            if (serviceId === 'google_translate' || serviceId === ADD_NEW_CUSTOM_SERVICE_ID) continue;
            const stringKey = `${serviceId}_keys_string`;
            const arrayKey = `${serviceId}_keys_array`;
            const keysString = GM_getValue(stringKey);
            if (typeof keysString === 'string') {
                const keysArray = keysString.replace(/[，]/g, ',').split(',').map(k => k.trim()).filter(Boolean);
                GM_setValue(arrayKey, keysArray);
            }
        }

        invalidateGlossaryCache();

        if (typeof syncPanelStateCallback === 'function') {
            syncPanelStateCallback();
        }

        const displayMode = GM_getValue('translation_display_mode', 'bilingual');
        applyDisplayModeChange(displayMode);
    }

    /**
     * 设置面板的结构与样式
     */
    function createSettingsPanelUI() {
        GM_addStyle(`
            #ao3-trans-settings-panel {
                display: none;
                position: fixed;
                z-index: 2147483647;
                width: 300px;
                background-color: #ffffff;
                border-radius: 12px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.12);
                color: #000000DE;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                overflow: hidden;
                border: 1px solid rgba(0, 0, 0, 0.12);
                --ao3-trans-primary-color: #1976d2;
                --ao3-trans-border-color: rgba(0, 0, 0, 0.23);
                --ao3-trans-border-hover: rgba(0, 0, 0, 0.87);
                --ao3-trans-label-color: rgba(0, 0, 0, 0.6);
                --ao3-trans-danger-color: #ff0000;
            }
            #ao3-trans-settings-panel.dragging {
                opacity: 0.8;
                transition: opacity 0.2s ease-in-out;
			}
            #ao3-trans-settings-panel.mobile-fixed-center {
                top: 50%; left: 50%; transform: translate(-50%, -50%); max-height: 85vh;
            }
            .settings-panel-header {
                padding: 0px 4px 0px 16px;
                border-bottom: 1px solid rgba(0, 0, 0, 0.12);
                cursor: move;
                user-select: none;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .settings-panel-header-title {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .settings-panel-header-title .home-icon-link {
                display: flex;
                align-items: center;
                justify-content: center;
                text-decoration: none;
                border-bottom: none;
            }
            .settings-panel-header-title .home-icon-link:focus {
                outline: none;
            }
            .settings-panel-header-title .home-icon-link svg {
                width: 24px;
                height: 24px;
                fill: #000000DE;
            }
            .settings-panel-header-title h2 {
                margin: 0; font-size: 16px; font-weight: bold;
                font-family: inherit;
            }
            .settings-panel-close-btn {
                cursor: pointer; width: 40px; height: 40px; border-radius: 50%;
                display: flex; align-items: center; justify-content: center;
                font-size: 24px; color: rgba(0, 0, 0, 0.54);
            }
            .settings-panel-body { padding: 18px 16px 16px; display: flex; flex-direction: column; gap: 16px; max-height: 70vh; overflow-y: auto; }

            .settings-switch-group { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
            .settings-panel-body > .settings-switch-group:first-child {
                padding-left: 14px;
            }
            .settings-panel-body > .settings-switch-group:first-child .settings-label {
                font-size: 15px;
            }
            .settings-switch-group .settings-label { font-size: 13px; font-weight: 400; color: #000000DE; }
            .settings-switch { position: relative; display: inline-block; width: 44px; height: 24px; }
            .settings-switch input { opacity: 0; width: 0; height: 0; }
            .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 24px; }
            .slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; }
            input:checked + .slider { background-color: #209CEE; }
            input:checked + .slider:before { transform: translateX(20px); }

            .settings-group { position: relative; }
            .settings-group.ao3-trans-control-disabled {
                pointer-events: none;
            }
            .settings-group.ao3-trans-control-disabled .settings-control[disabled] {
                color: #000000DE !important;
                -webkit-text-fill-color: #000000DE !important;
                opacity: 1 !important;
                background-color: #fff !important;
            }
            .settings-group .settings-control::placeholder {
                color: #a9a9a9 !important;
                -webkit-text-fill-color: #a9a9a9 !important;
                opacity: 1 !important;
            }
            .settings-group .settings-control {
                -webkit-appearance: none;
                appearance: none;
                width: 100%;
                height: 40px;
                padding: 0 12px;
                border-radius: 6px;
                border: 1px solid #ccc;
                background-color: #fff;
                font-size: 15px;
                font-family: inherit;
                box-sizing: border-box;
                line-height: 40px;
                color: #000000DE;
                box-shadow: none;
            }
            .settings-group .settings-control:hover { border-color: var(--ao3-trans-border-hover); }
            .settings-group .settings-control:focus {
                border-color: var(--ao3-trans-primary-color);
                border-width: 1px;
                outline: none;
            }
            .settings-group .settings-label {
                position: absolute;
                top: 50%;
                transform: translateY(-50%);
                left: 12px;
                font-size: 14px;
                color: var(--ao3-trans-label-color);
                pointer-events: none;
                transition: all 0.2s ease;
                background-color: #ffffff;
                padding: 0 4px;
            }
            .settings-group .settings-control:focus + .settings-label,
            .settings-group .settings-control.has-value + .settings-label {
                top: 0;
                left: 10px;
                font-size: 12px;
                color: var(--ao3-trans-primary-color);
            }
            .settings-group .settings-control:not(:focus).has-value + .settings-label {
                color: var(--ao3-trans-label-color);
            }
            .settings-group.static-label .settings-label {
                top: 0; left: 10px; font-size: 12px; transform: translateY(-50%); color: var(--ao3-trans-label-color);
            }
            .settings-group.static-label .settings-control {
                line-height: normal;
                padding-top: 4px;
                padding-bottom: 4px;
                height: 40px;
            }
            .settings-group.settings-group-select .settings-control.settings-select {
                padding-right: 40px;
            }
            .settings-group.settings-group-select::after {
                content: '';
                position: absolute;
                right: 14px;
                top: 20px;
                transform: translateY(-50%) rotate(0deg);
                width: .65em;
                height: .65em;
                background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23666%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-13%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2013l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-13%200-5-1.9-9.4-5.4-13z%22%2F%3E%3C%2Fsvg%3E');
                background-repeat: no-repeat;
                background-position: center;
                background-size: contain;
                pointer-events: none;
            }
            .settings-group.settings-group-select.dropdown-active::after {
                transform: translateY(-50%) rotate(180deg);
            }
			.settings-action-button-inline:focus,
            .online-glossary-delete-btn:focus,
            .custom-dropdown-menu li .item-action-btn:focus {
                outline: none;
            }

            .input-wrapper { position: relative; }
            .input-wrapper .settings-input { padding-right: 52px !important; }
            .settings-action-button-inline {
                position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
                background: none; border: none; color: var(--ao3-trans-primary-color);
                font-size: 14px; font-weight: 500; cursor: pointer; padding: 4px;
                display: flex; align-items: center;
            }

            .editable-section { display: none; }
            .online-glossary-manager { display: flex; flex-direction: column; gap: 0px; }
            .online-glossary-details {
                width: 100%;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 12px;
                color: #666;
                padding: 4px 12px;
                overflow: hidden;
            }
            #online-glossary-details-container {
                margin-top: 8px;
            }
            #online-glossary-info {
                flex-grow: 1;
                text-align: left;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                padding-right: 8px;
                min-width: 0;
            }
            .online-glossary-delete-btn {
                flex-shrink: 0;
                background: none;
                border: none;
                color: var(--ao3-trans-primary-color);
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                padding: 2px 4px;
                text-align: right;
            }
            .online-glossary-delete-btn[data-confirming="true"] {
                color: var(--ao3-trans-danger-color);
            }

            .custom-dropdown-backdrop {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: transparent;
                z-index: 2147483647;
            }
            .custom-dropdown-menu {
                position: fixed;
                background-color: #ffffff;
                border-radius: 8px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                border: 1px solid rgba(0, 0, 0, 0.08);
                z-index: 2147483647;
                overflow: hidden;
                opacity: 0;
                transform: scale(0.95) translateY(-10px);
                transform-origin: top center;
                transition: opacity 0.15s ease-out, transform 0.15s ease-out;
                box-sizing: border-box;
                --ao3-trans-primary-color: #1976d2;
                --ao3-trans-danger-color: #ff0000;
            }
            .custom-dropdown-menu.visible {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
            .custom-dropdown-menu ul {
                list-style: none;
                margin: 0;
                padding: 8px 0;
                max-height: 250px;
                overflow-y: auto;
            }
            .custom-dropdown-menu li {
                padding: 8px 16px;
                cursor: pointer;
                font-size: 15px;
                transition: background-color 0.2s ease;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
            }
            .custom-dropdown-menu li:hover {
                background-color: #f5f5f5;
            }
            .custom-dropdown-menu li.selected {
                background-color: #e3f2fd;
            }
            .custom-dropdown-menu li .item-text {
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                flex-grow: 1;
            }
            .custom-dropdown-menu li .item-actions {
                display: flex;
                gap: 8px;
                flex-shrink: 0;
            }
            .custom-dropdown-menu li .item-action-btn {
                font-size: 13px;
                font-weight: 500;
                background: none;
                border: none;
                padding: 0;
                cursor: pointer;
            }
            .custom-dropdown-menu li .item-action-btn.edit {
                color: var(--ao3-trans-primary-color);
            }
            .custom-dropdown-menu li .item-action-btn.delete,
            .custom-dropdown-menu li .item-action-btn.toggle-glossary {
                color: var(--ao3-trans-primary-color);
            }
            .custom-dropdown-menu li .item-action-btn.delete[data-confirming="true"] {
                color: var(--ao3-trans-danger-color);
            }
            .custom-dropdown-menu ul::-webkit-scrollbar {
                width: 5px;
            }
            .custom-dropdown-menu ul::-webkit-scrollbar-track {
                background: transparent;
            }
            .custom-dropdown-menu ul::-webkit-scrollbar-thumb {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 3px;
            }
            #custom-service-url-notice {
                font-size: 12px;
                color: #555;
                padding: 8px 12px;
                background-color: #f0f0f0;
                border-radius: 4px;
                margin-top: -8px;
            }
            #custom-service-url-notice a {
                color: var(--ao3-trans-primary-color);
                text-decoration: none;
            }
            #custom-service-url-notice a:hover {
                text-decoration: underline;
            }
            #glossary-manage-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
                border: 1px solid #ccc;
                border-radius: 6px;
                padding: 8px;
                max-height: 150px;
                overflow-y: auto;
            }
            .glossary-manage-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 14px;
            }
            .glossary-manage-item .name {
                flex-grow: 1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-right: 8px;
            }
            .glossary-manage-item .actions {
                display: flex;
                gap: 8px;
                flex-shrink: 0;
            }
            .glossary-manage-item .actions button {
                font-size: 13px;
                font-weight: 500;
                background: none;
                border: none;
                padding: 2px 4px;
                cursor: pointer;
                color: var(--ao3-trans-primary-color);
            }
            .glossary-manage-item .actions .delete-btn[data-confirming="true"] {
                color: var(--ao3-trans-danger-color);
            }
            .data-sync-actions-container {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px 0;
                margin-top: -8px;
            }
            .data-sync-action-btn {
                background: none;
                border: none;
                color: var(--ao3-trans-primary-color);
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                padding: 2px 4px;
                text-align: center;
            }
            .data-sync-action-btn:focus {
                outline: none;
            }
        `);

        const panel = document.createElement('div');
        panel.id = 'ao3-trans-settings-panel';
        const scriptVersion = GM_info.script.version.split('-')[0];

        panel.innerHTML = `
            <div class="settings-panel-header">
                <div class="settings-panel-header-title">
                    <a href="https://github.com/V-Lipset/ao3-chinese" target="_blank" class="home-icon-link" title="访问项目主页">
                        <svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M240-200h120v-240h240v240h120v-360L480-740 240-560v360Zm-80 80v-480l320-240 320 240v480H520v-240h-80v240H160Zm320-350Z"/></svg>
                    </a>
                    <h2>AO3 汉化插件 v${scriptVersion}</h2>
                </div>
                <span class="settings-panel-close-btn" title="关闭">&times;</span>
            </div>
            <div class="settings-panel-body">
                <div class="settings-switch-group">
                    <span class="settings-label">启用翻译功能</span>
                    <label class="settings-switch">
                        <input type="checkbox" id="setting-master-switch">
                        <span class="slider"></span>
                    </label>
                </div>

                <div class="settings-group settings-group-select">
                    <select id="setting-display-mode" class="settings-control settings-select custom-styled-select">
                        <option value="bilingual">双语对照</option>
                        <option value="translation_only">仅译文</option>
                    </select>
                    <label for="setting-display-mode" class="settings-label">显示模式</label>
                </div>

                <div class="settings-group settings-group-select">
                    <select id="setting-trans-engine" class="settings-control settings-select custom-styled-select"></select>
                    <label for="setting-trans-engine" class="settings-label">翻译服务</label>
                </div>

                <div id="custom-service-container" style="display: none; flex-direction: column; gap: 16px;"></div>

                <div class="settings-group settings-group-select" id="setting-model-group" style="display: none;">
                    <select id="setting-trans-model" class="settings-control settings-select custom-styled-select"></select>
                    <label for="setting-trans-model" class="settings-label">使用模型</label>
                </div>

                <div class="settings-group static-label" id="api-key-group">
                    <div class="input-wrapper">
                        <input type="text" id="setting-input-apikey" class="settings-control settings-input" spellcheck="false">
                        <label for="setting-input-apikey" class="settings-label">设置 API Key</label>
                        <button id="setting-btn-apikey-save" class="settings-action-button-inline">保存</button>
                    </div>
                </div>

                <div class="settings-group static-label settings-group-select">
                    <select id="setting-glossary-actions" class="settings-control settings-select custom-styled-select">
                        <option value="">请选择一个功能</option>
                        <option value="local">设置本地术语表</option>
                        <option value="forbidden">设置禁翻术语表</option>
                        <option value="import">导入在线术语表</option>
                        <option value="manage">管理在线术语表</option>
                        <option value="post_replace">译文后处理替换</option>
                        <option value="data_sync">数据导入与导出</option>
                    </select>
                    <label for="setting-glossary-actions" class="settings-label">更多功能</label>
                </div>

                <div id="data-sync-actions-container" class="data-sync-actions-container" style="display: none;">
                    <button id="btn-import-data" class="data-sync-action-btn">数据导入</button>
                    <button id="btn-export-data" class="data-sync-action-btn">数据导出</button>
                </div>

                <div id="editable-section-glossary-local" class="settings-group static-label editable-section">
                    <div class="input-wrapper">
                        <input type="text" id="setting-input-glossary-local" class="settings-control settings-input" placeholder="原文1：译文1，原文2：译文2" spellcheck="false">
                        <label for="setting-input-glossary-local" class="settings-label">本地术语表</label>
                        <button id="setting-btn-glossary-local-save" class="settings-action-button-inline">保存</button>
                    </div>
                </div>
                <div id="editable-section-glossary-forbidden" class="settings-group static-label editable-section">
                    <div class="input-wrapper">
                        <input type="text" id="setting-input-glossary-forbidden" class="settings-control settings-input" placeholder="原文1，原文2，原文3" spellcheck="false">
                        <label for="setting-input-glossary-forbidden" class="settings-label">禁翻术语表</label>
                        <button id="setting-btn-glossary-forbidden-save" class="settings-action-button-inline">保存</button>
                    </div>
                </div>
                <div id="editable-section-glossary-import" class="settings-group static-label editable-section">
                    <div class="input-wrapper">
                        <input type="text" id="setting-input-glossary-import-url" class="settings-control settings-input" placeholder="请输入 GitHub/jsDelivr 链接" spellcheck="false">
                        <label for="setting-input-glossary-import-url" class="settings-label">在线术语表</label>
                        <button id="setting-btn-glossary-import-save" class="settings-action-button-inline">导入</button>
                    </div>
                </div>
                <div id="editable-section-glossary-manage" class="settings-group static-label editable-section online-glossary-manager">
                    <div class="settings-group settings-group-select">
                        <select id="setting-select-glossary-manage" class="settings-control settings-select custom-styled-select"></select>
                        <label for="setting-select-glossary-manage" class="settings-label">已导入的术语表</label>
                    </div>
                    <div id="online-glossary-details-container" style="display: none;">
                        <div class="online-glossary-details">
                            <span id="online-glossary-info"></span>
                            <button id="online-glossary-delete-btn" class="online-glossary-delete-btn">删除</button>
                        </div>
                    </div>
                </div>
                <div id="editable-section-post-replace" class="settings-group static-label editable-section">
                    <div class="input-wrapper">
                        <input type="text" id="setting-input-post-replace" class="settings-control settings-input" placeholder="译文1：替换1，译文2：替换2" spellcheck="false">
                        <label for="setting-input-post-replace" class="settings-label">译文后处理替换</label>
                        <button id="setting-btn-post-replace-save" class="settings-action-button-inline">保存</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        return {
            panel,
            closeBtn: panel.querySelector('.settings-panel-close-btn'),
            header: panel.querySelector('.settings-panel-header'),
            masterSwitch: panel.querySelector('#setting-master-switch'),
            engineSelect: panel.querySelector('#setting-trans-engine'),
            modelGroup: panel.querySelector('#setting-model-group'),
            modelSelect: panel.querySelector('#setting-trans-model'),
            displayModeSelect: panel.querySelector('#setting-display-mode'),
            apiKeyGroup: panel.querySelector('#api-key-group'),
            apiKeyInput: panel.querySelector('#setting-input-apikey'),
            apiKeySaveBtn: panel.querySelector('#setting-btn-apikey-save'),
            customServiceContainer: panel.querySelector('#custom-service-container'),
            glossaryActionsSelect: panel.querySelector('#setting-glossary-actions'),
            editableSections: panel.querySelectorAll('.editable-section'),
            glossaryLocalSection: panel.querySelector('#editable-section-glossary-local'),
            glossaryLocalInput: panel.querySelector('#setting-input-glossary-local'),
            glossaryLocalSaveBtn: panel.querySelector('#setting-btn-glossary-local-save'),
            glossaryForbiddenSection: panel.querySelector('#editable-section-glossary-forbidden'),
            glossaryForbiddenInput: panel.querySelector('#setting-input-glossary-forbidden'),
            glossaryForbiddenSaveBtn: panel.querySelector('#setting-btn-glossary-forbidden-save'),
            glossaryImportSection: panel.querySelector('#editable-section-glossary-import'),
            glossaryImportUrlInput: panel.querySelector('#setting-input-glossary-import-url'),
            glossaryImportSaveBtn: panel.querySelector('#setting-btn-glossary-import-save'),
            glossaryManageSection: panel.querySelector('#editable-section-glossary-manage'),
            glossaryManageSelect: panel.querySelector('#setting-select-glossary-manage'),
            glossaryManageDetailsContainer: panel.querySelector('#online-glossary-details-container'),
            glossaryManageInfo: panel.querySelector('#online-glossary-info'),
            glossaryManageDeleteBtn: panel.querySelector('#online-glossary-delete-btn'),
            postReplaceSection: panel.querySelector('#editable-section-post-replace'),
            postReplaceInput: panel.querySelector('#setting-input-post-replace'),
            postReplaceSaveBtn: panel.querySelector('#setting-btn-post-replace-save'),
            dataSyncActionsContainer: panel.querySelector('#data-sync-actions-container'),
            importDataBtn: panel.querySelector('#btn-import-data'),
            exportDataBtn: panel.querySelector('#btn-export-data'),
        };
    }

    /**
     * 显示一个自定义的确认模态框
     */
    function showCustomConfirm(message, title = '请确认') {
        return new Promise((resolve, reject) => {
            if (document.getElementById('ao3-custom-confirm-overlay')) {
                return reject(new Error('已有确认框正在显示中。'));
            }

            GM_addStyle(`
                #ao3-custom-confirm-overlay {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    z-index: 2147483647; display: flex; align-items: center; justify-content: center;
                }
                #ao3-custom-confirm-modal {
                    background-color: #fff; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                    width: 90%; max-width: 400px; overflow: hidden;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                }
                .ao3-custom-confirm-header {
                    padding: 12px 16px; border-bottom: 1px solid #e0e0e0;
                    text-align: center;
                }
                .ao3-custom-confirm-header h3 {
                    margin: 0; font-size: 16px; font-weight: 600; color: #000;
                }
                .ao3-custom-confirm-body {
                    padding: 16px; font-size: 14px; line-height: 1.6; color: #000;
                    white-space: pre-wrap;
                }
                .ao3-custom-confirm-body p {
                    text-indent: 2em;
                    margin: 0;
                }
                .ao3-custom-confirm-footer {
                    padding: 12px 16px; background-color: #fff;
                    display: flex; justify-content: flex-end; gap: 12px;
                }
                .ao3-custom-confirm-btn {
                    padding: 8px 16px; border: none; border-radius: 6px;
                    font-size: 14px; font-weight: 500; cursor: pointer;
                    background: none !important;
                    background-color: transparent !important;
                    color: #000;
                }
                .ao3-custom-confirm-btn:focus {
                    outline: none;
                }
            `);

            const overlay = document.createElement('div');
            overlay.id = 'ao3-custom-confirm-overlay';

            const modal = document.createElement('div');
            modal.id = 'ao3-custom-confirm-modal';
            modal.innerHTML = `
                <div class="ao3-custom-confirm-header"><h3>${title}</h3></div>
                <div class="ao3-custom-confirm-body">${message.split('\n').map(line => `<p>${line}</p>`).join('')}</div>
                <div class="ao3-custom-confirm-footer">
                    <button class="ao3-custom-confirm-btn cancel">取消</button>
                    <button class="ao3-custom-confirm-btn confirm">确定</button>
                </div>
            `;

            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            const cleanup = () => {
                overlay.remove();
            };

            const confirmBtn = modal.querySelector('.confirm');
            const cancelBtn = modal.querySelector('.cancel');

            confirmBtn.addEventListener('click', () => {
                cleanup();
                resolve();
            });

            cancelBtn.addEventListener('click', () => {
                cleanup();
                reject(new Error('User cancelled.'));
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    cleanup();
                    reject(new Error('User cancelled by clicking overlay.'));
                }
            });
        });
    }

    /**
     * 创建并管理自定义翻译服务的 UI 和逻辑
     */
    function createCustomServiceManager(panelElements, syncPanelStateCallback) {
        const { customServiceContainer, modelGroup, modelSelect, apiKeyGroup } = panelElements;
        let currentServiceId = null;
        let currentEditSection = 'name';
        let isPendingCreation = false;
        let pendingServiceData = {};
        const CUSTOM_URL_FIRST_SAVE_DONE = 'custom_url_first_save_done';

        const getServices = () => GM_getValue(CUSTOM_SERVICES_LIST_KEY, []);
        const setServices = (services) => GM_setValue(CUSTOM_SERVICES_LIST_KEY, services);

        const ensureServiceExists = () => {
            if (!isPendingCreation) return currentServiceId;
            const services = getServices();
            const newService = { ...pendingServiceData, id: `custom_${Date.now()}` };
            services.push(newService);
            setServices(services);

            isPendingCreation = false;
            currentServiceId = newService.id;
            GM_setValue('transEngine', currentServiceId);

            return newService.id;
        };

        const saveServiceField = (field, value) => {
            const serviceId = isPendingCreation ? ensureServiceExists() : currentServiceId;

            if (field === 'apiKey') {
                GM_setValue(`${serviceId}_keys_string`, value);
            } else {
                const services = getServices();
                const serviceIndex = services.findIndex(s => s.id === serviceId);
                if (serviceIndex > -1) {
                    services[serviceIndex][field] = value;
                    setServices(services);
                }
            }
            return serviceId;
        };

        const saveAndSyncCustomServiceField = (field, value) => {
            const serviceId = saveServiceField(field, value);
            synchronizeAllSettings(syncPanelStateCallback);
            triggerModelFetchIfReady(serviceId);
        };

        const triggerModelFetchIfReady = (serviceId) => {
            if (!serviceId) return;
            const services = getServices();
            const service = services.find(s => s.id === serviceId);
            if (!service) return;

            const apiKey = (GM_getValue(`${serviceId}_keys_array`, [])[0] || '').trim();
            const modelsExist = service.models && service.models.length > 0;

            if (service.url && apiKey && !modelsExist) {
                fetchModelsForService(serviceId, service.url);
            }
        };

        const fetchModelsForService = async (serviceId, url) => {
            const serviceName = (getServices().find(s => s.id === serviceId) || {}).name || '新服务';
            try {
                const apiKey = (GM_getValue(`${serviceId}_keys_array`, [])[0] || '').trim();
                if (!apiKey) return;

                const modelsUrl = url.replace(/\/chat\/?(completions)?\/?$/, '') + '/models';

                const response = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: modelsUrl,
                        headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' },
                        responseType: 'json',
                        timeout: 15000,
                        onload: res => {
                            if (res.status === 200 && res.response) {
                                resolve(res.response);
                            } else {
                                reject(new Error(`服务器返回状态 ${res.status}。请检查接口地址和 API Key。`));
                            }
                        },
                        onerror: () => reject(new Error('网络请求失败，请检查您的网络连接和浏览器控制台。')),
                        ontimeout: () => reject(new Error('请求超时。'))
                    });
                });

                const models = getNestedProperty(response, 'data');
                if (!Array.isArray(models) || models.length === 0) {
                    throw new Error('API 返回的数据格式不正确或模型列表为空。');
                }

                const modelIds = models.map(m => m.id).filter(Boolean);
                if (modelIds.length === 0) {
                    throw new Error('未能从 API 响应中提取任何有效的模型 ID。');
                }

                saveServiceField('models', modelIds);
                saveServiceField('modelsRaw', modelIds.join(', '));
                notifyAndLog(`成功为“${serviceName}”获取 ${modelIds.length} 个可用模型！`, '操作成功');

                const actionSelect = customServiceContainer.querySelector('#custom-service-action-select');
                if (actionSelect) {
                    actionSelect.value = 'models';
                    actionSelect.dispatchEvent(new Event('change', { bubbles: true }));
                }

                if (syncPanelStateCallback) {
                    syncPanelStateCallback();
                }

            } catch (error) {
                console.error('[模型获取] 失败:', error);
                notifyAndLog(`自动获取模型失败：${error.message}`, '操作失败', 'error');
            }
        };

        function renderEditMode(serviceId) {
            currentServiceId = serviceId;

            if (serviceId) {
                const lastActionKey = `custom_service_last_action_${serviceId}`;
                currentEditSection = GM_getValue(lastActionKey, 'name');
            }

            let serviceData;
            if (isPendingCreation) {
                serviceData = pendingServiceData;
            } else {
                const services = getServices();
                serviceData = services.find(s => s.id === serviceId) || {};
            }

            customServiceContainer.innerHTML = `
                <div class="settings-group static-label settings-group-select">
                    <select id="custom-service-action-select" class="settings-control settings-select custom-styled-select">
                        <option value="name">设置服务名称</option>
                        <option value="url">设置接口地址</option>
                        <option value="apiKey">设置 API Key</option>
                        <option value="models">设置模型 ID</option>
                    </select>
                    <label for="custom-service-action-select" class="settings-label">自定义翻译服务</label>
                </div>
                <div id="custom-service-editor"></div>
            `;
            customServiceContainer.style.display = 'flex';

            const actionSelect = customServiceContainer.querySelector('#custom-service-action-select');
            actionSelect.value = currentEditSection;

            renderEditSection(serviceData);
        }

        const renderEditSection = (service) => {
            const editorDiv = customServiceContainer.querySelector('#custom-service-editor');
            editorDiv.innerHTML = '';
            apiKeyGroup.style.display = 'none';

            const createInputSection = (id, label, placeholder, value, fieldName) => {
                const section = document.createElement('div');
                section.className = 'settings-group static-label';
                section.innerHTML = `
                    <div class="input-wrapper">
                        <input type="text" id="${id}" class="settings-control settings-input" placeholder="${placeholder}" spellcheck="false">
                        <label for="${id}" class="settings-label">${label}</label>
                        <button class="settings-action-button-inline">保存</button>
                    </div>
                `;
                const input = section.querySelector('input');
                input.value = value;
                section.querySelector('button').addEventListener('click', async () => {
                    const trimmedValue = input.value.trim();
                    if (fieldName === 'url' && trimmedValue && !trimmedValue.startsWith('http')) {
                        notifyAndLog('接口地址格式不正确，必须以 http 或 https 开头。', '保存失败', 'error');
                        return;
                    }
                    saveAndSyncCustomServiceField(fieldName, trimmedValue);

                    if (fieldName === 'url') {
                        const isFirstSaveEver = !GM_getValue(CUSTOM_URL_FIRST_SAVE_DONE, false);
                        if (isFirstSaveEver) {
                            GM_setValue(CUSTOM_URL_FIRST_SAVE_DONE, true);
                            const confirmationMessage = `您正在添加一个自定义翻译服务接口地址。\n为了保护您的浏览器安全，油猴脚本要求您为这个新地址手动授权。\n您需要将刚才输入的接口地址域名添加到脚本的 “域名白名单” 中。这是一个首次设置时必须进行的一次性操作。\n点击 “确定” ，将跳转到一份图文版操作教程；点击 “取消” ，则不会进行跳转。\n此提示仅显示一次，是否跳转到教程页面？`;
                            try {
                                await showCustomConfirm(confirmationMessage, '安全授权');
                                window.open('https://v-lipset.github.io/ao3-chinese/guide/whitelist.html', '_blank');
                            } catch (e) {}
                        }
                    }
                });
                return section;
            };

            switch (currentEditSection) {
                case 'name':
                    editorDiv.appendChild(createInputSection('custom-service-name-input', '服务名称', '', service.name || '', 'name'));
                    break;
                case 'url':
                    editorDiv.appendChild(createInputSection('custom-service-url-input', '接口地址', 'https://api.example.com/v1/chat/completions', service.url || '', 'url'));
                    break;
                case 'models':
                    editorDiv.dataset.mode = 'select';
                    renderModelEditor(service);
                    break;
                case 'apiKey':
                    const serviceId = currentServiceId || (isPendingCreation ? 'pending_custom' : null);
                    const apiKeyString = serviceId === 'pending_custom' ? '' : GM_getValue(`${serviceId}_keys_string`, '');
                    const serviceName = service.name || (isPendingCreation ? '新服务' : '自定义服务');
                    editorDiv.appendChild(createInputSection('custom-service-apikey-input', `设置 ${serviceName} API Key`, 'Key 1，Key 2，Key 3', apiKeyString, 'apiKey'));
                    break;
            }
            panelElements.panel.querySelectorAll('.settings-control').forEach(el => {
                if (el.value) el.classList.add('has-value');
            });
        };

        const renderModelEditor = (service) => {
            const editorDiv = customServiceContainer.querySelector('#custom-service-editor');
            editorDiv.innerHTML = '';
            const modelsRaw = service.modelsRaw || (service.models || []).join(', ');

            if (editorDiv.dataset.mode === 'edit' || !modelsRaw) {
                const section = document.createElement('div');
                section.className = 'settings-group static-label';
                section.innerHTML = `
                    <div class="input-wrapper">
                        <input type="text" id="custom-service-models-input" class="settings-control settings-input" placeholder="model 1，model 2，model 3" spellcheck="false">
                        <label for="custom-service-models-input" class="settings-label">模型 ID</label>
                        <button class="settings-action-button-inline">保存</button>
                    </div>
                `;
                const input = section.querySelector('input');
                input.value = modelsRaw;
                section.querySelector('button').addEventListener('click', () => {
                    const rawValue = input.value;
                    const normalizedModels = rawValue.replace(/[，]/g, ',').split(',').map(m => m.trim()).filter(Boolean);
                    saveAndSyncCustomServiceField('models', normalizedModels);
                    saveAndSyncCustomServiceField('modelsRaw', rawValue);
                    editorDiv.dataset.mode = 'select';
                });
                editorDiv.appendChild(section);
            } else {
                const section = document.createElement('div');
                section.className = 'settings-group static-label settings-group-select';
                const select = document.createElement('select');
                select.id = 'custom-service-models-select';
                select.className = 'settings-control settings-select custom-styled-select';
                (service.models || []).forEach(modelId => {
                    const option = document.createElement('option');
                    option.value = modelId;
                    option.textContent = modelId;
                    select.appendChild(option);
                });
                const editOption = document.createElement('option');
                editOption.value = 'edit_models';
                editOption.textContent = '编辑模型 ID';
                select.appendChild(editOption);
                section.innerHTML = `<label for="custom-service-models-select" class="settings-label">模型 ID</label>`;
                section.prepend(select);

                const activeModel = GM_getValue(`${ACTIVE_MODEL_PREFIX_KEY}${currentServiceId}`, (service.models || [])[0]);
                if (activeModel) {
                    select.value = activeModel;
                }

                select.addEventListener('change', () => {
                    if (select.value === 'edit_models') {
                        editorDiv.dataset.mode = 'edit';
                        renderModelEditor(service);
                    } else {
                        GM_setValue(`${ACTIVE_MODEL_PREFIX_KEY}${currentServiceId}`, select.value);
                    }
                });
                editorDiv.appendChild(section);
            }
            panelElements.panel.querySelectorAll('.settings-control').forEach(el => {
                if (el.value) el.classList.add('has-value');
            });
        };

        return {
            enterEditMode: (serviceId) => {
                isPendingCreation = false;
                renderEditMode(serviceId);
            },
            startPendingCreation: () => {
                isPendingCreation = true;
                currentEditSection = 'name';
                const services = getServices();
                const defaultNamePrefix = '默认 ';
                const defaultNames = services.filter(s => s.name.startsWith(defaultNamePrefix))
                                             .map(s => parseInt(s.name.substring(defaultNamePrefix.length), 10))
                                             .filter(n => !isNaN(n));
                let nextNum = 1;
                while (defaultNames.includes(nextNum)) {
                    nextNum++;
                }

                pendingServiceData = {
                    name: `${defaultNamePrefix}${nextNum}`,
                    url: '',
                    models: [],
                    modelsRaw: ''
                };

                modelGroup.style.display = 'none';
                apiKeyGroup.style.display = 'none';
                renderEditMode(null);
            },
            isPending: () => isPendingCreation,
            cancelPending: () => {
                isPendingCreation = false;
                pendingServiceData = {};
            },
            updatePendingSection: (newAction) => {
                if (isPendingCreation) {
                    currentEditSection = newAction;
                    renderEditMode(null);
                }
            },
            renderDisplayModeModelSelect: (serviceId) => {
                const services = getServices();
                const service = services.find(s => s.id === serviceId);
                if (!service) return;

                const models = service.models || [];
                modelSelect.innerHTML = '';

                if (models.length === 0) {
                    const noModelOption = document.createElement('option');
                    noModelOption.disabled = true;
                    noModelOption.selected = true;
                    noModelOption.textContent = '暂无模型';
                    modelSelect.appendChild(noModelOption);
                    modelSelect.disabled = true;
                } else {
                    models.forEach(modelId => {
                        const option = document.createElement('option');
                        option.value = modelId;
                        option.textContent = modelId;
                        modelSelect.appendChild(option);
                    });
                    modelSelect.disabled = false;
                    const activeModel = GM_getValue(`${ACTIVE_MODEL_PREFIX_KEY}${serviceId}`, models[0]);
                    modelSelect.value = activeModel;
                }
                modelGroup.style.display = 'block';
            },
            deleteService: (serviceId) => {
                let services = getServices();
                services = services.filter(s => s.id !== serviceId);
                setServices(services);

                GM_deleteValue(`${serviceId}_keys_string`);
                GM_deleteValue(`${serviceId}_keys_array`);
                GM_deleteValue(`${serviceId}_key_index`);
                GM_deleteValue(`${ACTIVE_MODEL_PREFIX_KEY}${serviceId}`);
                GM_deleteValue(`custom_service_last_action_${serviceId}`);

                const currentEngine = getValidEngineName();
                if (currentEngine === serviceId) {
                    GM_setValue('transEngine', 'google_translate');
                }

                if (syncPanelStateCallback) {
                    syncPanelStateCallback();
                }
                notifyAndLog('自定义服务已删除。');
            }
        };
    }

    /**
     * 设置面板的内部逻辑
     */
    function initializeSettingsPanelLogic(panelElements, rerenderMenuCallback, onPanelCloseCallback) {
        const {
            panel, closeBtn, header, masterSwitch, engineSelect, modelGroup, modelSelect, displayModeSelect,
            apiKeyGroup, apiKeyInput, apiKeySaveBtn, customServiceContainer,
            glossaryActionsSelect, editableSections,
            glossaryLocalSection, glossaryLocalInput, glossaryLocalSaveBtn,
            glossaryForbiddenSection, glossaryForbiddenInput, glossaryForbiddenSaveBtn,
            glossaryImportSection, glossaryImportUrlInput, glossaryImportSaveBtn,
            glossaryManageSection, glossaryManageSelect, glossaryManageDetailsContainer,
            glossaryManageInfo, glossaryManageDeleteBtn,
            postReplaceSection, postReplaceInput, postReplaceSaveBtn,
            dataSyncActionsContainer, importDataBtn, exportDataBtn
        } = panelElements;

        const PANEL_POSITION_KEY = 'ao3_panel_position';
        const GLOSSARY_ACTION_KEY = 'ao3_glossary_last_action';
        let isDragging = false;
        let origin = { x: 0, y: 0 }, startPosition = { x: 0, y: 0 };
        let activeDropdown = null;

        const populateEngineSelect = () => {
            engineSelect.innerHTML = '';
            const customServices = GM_getValue(CUSTOM_SERVICES_LIST_KEY, []);

            const createOption = (engineId, config) => {
                const option = document.createElement('option');
                option.value = engineId;
                option.textContent = config.displayName;
                return option;
            };

            engineSelect.appendChild(createOption('google_translate', engineMenuConfig['google_translate']));

            const sortedBuiltInServices = Object.keys(engineMenuConfig)
                .filter(id => id !== 'google_translate' && id !== ADD_NEW_CUSTOM_SERVICE_ID)
                .sort((a, b) => engineMenuConfig[a].displayName.localeCompare(engineMenuConfig[b].displayName));

            sortedBuiltInServices.forEach(id => {
                engineSelect.appendChild(createOption(id, engineMenuConfig[id]));
            });

            customServices.forEach(service => {
                const option = document.createElement('option');
                option.value = service.id;
                option.textContent = service.name || `默认 ${customServices.indexOf(service) + 1}`;
                option.dataset.isCustom = 'true';
                engineSelect.appendChild(option);
            });

            engineSelect.appendChild(createOption(ADD_NEW_CUSTOM_SERVICE_ID, engineMenuConfig[ADD_NEW_CUSTOM_SERVICE_ID]));
        };

        const syncPanelState = () => {
            const isEnabled = GM_getValue('enable_transDesc', false);
            masterSwitch.checked = isEnabled;

            populateEngineSelect();
            const currentEngine = getValidEngineName();
            engineSelect.value = currentEngine;
            engineSelect.dispatchEvent(new Event('change'));

            displayModeSelect.value = GM_getValue('translation_display_mode', 'bilingual');

            panel.querySelectorAll('.settings-group').forEach(group => {
                group.classList.toggle('ao3-trans-control-disabled', !isEnabled);
            });
            panel.querySelectorAll('.settings-control, .settings-input, .settings-action-button-inline, .online-glossary-delete-btn, .data-sync-action-btn').forEach(el => {
                el.disabled = !isEnabled;
            });

            updateAllLabels();
        };

        const updateApiKeySection = (engineId) => {
            const config = engineMenuConfig[engineId];
            if (config && config.requiresApiKey) {
                apiKeyGroup.style.display = 'block';
                const stringKeyName = `${engineId}_keys_string`;
                apiKeyInput.value = GM_getValue(stringKeyName, '');
                apiKeyGroup.querySelector('.settings-label').textContent = `设置 ${config.displayName} API Key`;
                apiKeyInput.placeholder = 'Key 1，Key 2，Key 3';
                updateInputLabel(apiKeyInput);
            } else {
                apiKeyGroup.style.display = 'none';
            }
        };

        panelElements.updateApiKeySection = updateApiKeySection;
		const customServiceManager = createCustomServiceManager(panelElements, syncPanelState, populateEngineSelect);

        const isMobile = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        const ensureOnScreen = (pos, size) => {
            const newPos = { ...pos };
            const winW = document.documentElement.clientWidth;
            const winH = window.innerHeight;
            const margin = 10;

            newPos.x = Math.max(margin, Math.min(newPos.x, winW - size.width - margin));
            newPos.y = Math.max(margin, Math.min(newPos.y, winH - size.height - margin));
            return newPos;
        };

        const updatePanelPosition = () => {
            if (panel.style.display !== 'block') return;

            if (isMobile()) {
                panel.classList.add('mobile-fixed-center');
                panel.style.left = '';
                panel.style.top = '';
            } else {
                panel.classList.remove('mobile-fixed-center');
                panel.style.visibility = 'hidden';
                const panelRect = panel.getBoundingClientRect();
                panel.style.visibility = 'visible';

                let savedPos = GM_getValue(PANEL_POSITION_KEY);
                const hasBeenOpened = GM_getValue('panel_has_been_opened_once', false);

                if (!hasBeenOpened) {
                    const winW = document.documentElement.clientWidth;
                    const winH = window.innerHeight;
                    savedPos = {
                        x: (winW - panelRect.width) / 2,
                        y: (winH - panelRect.height) / 2
                    };
                    GM_setValue(PANEL_POSITION_KEY, savedPos);
                    GM_setValue('panel_has_been_opened_once', true);
                } else if (!savedPos || isDragging) {
                    savedPos = { x: panel.offsetLeft, y: panel.offsetTop };
                }

                const correctedPos = ensureOnScreen(savedPos, { width: panelRect.width, height: panelRect.height });
                panel.style.left = `${correctedPos.x}px`;
                panel.style.top = `${correctedPos.y}px`;
            }
            repositionActiveDropdown();
        };

        const updateInputLabel = (input) => {
            if (!input) return;
            if (input.value && (input.tagName !== 'SELECT' || input.options[input.selectedIndex]?.disabled !== true)) {
                input.classList.add('has-value');
            } else {
                input.classList.remove('has-value');
            }
        };

        const updateAllLabels = () => {
            panel.querySelectorAll('.settings-control').forEach(updateInputLabel);
        };

        const toggleEditableSection = (sectionToShow) => {
            editableSections.forEach(s => s.style.display = 'none');
            dataSyncActionsContainer.style.display = 'none';
            if (sectionToShow) {
                if (sectionToShow.id === 'editable-section-glossary-manage') {
                    sectionToShow.style.display = 'flex';
                } else {
                    sectionToShow.style.display = 'block';
                }
                const input = sectionToShow.querySelector('.settings-control');
                if (input) updateInputLabel(input);
            }
        };

        const updateModelSelect = (engineId) => {
            const config = engineMenuConfig[engineId];
            modelGroup.style.display = 'none';

            if (config && config.modelMapping) {
                modelSelect.innerHTML = '';
                Object.keys(config.modelMapping).forEach(modelId => {
                    const option = document.createElement('option');
                    option.value = modelId;
                    option.textContent = config.modelMapping[modelId];
                    modelSelect.appendChild(option);
                });
                modelSelect.disabled = false;
                modelSelect.value = GM_getValue(config.modelGmKey, Object.keys(config.modelMapping)[0]);
                modelGroup.style.display = 'block';
            } else if (engineId.startsWith('custom_')) {
                customServiceManager.renderDisplayModeModelSelect(engineId);
            }
        };

        const saveApiKey = () => {
            const engineId = engineSelect.value;
            const value = apiKeyInput.value;

            if (engineId.startsWith('custom_') || (engineId === ADD_NEW_CUSTOM_SERVICE_ID && customServiceManager.isPending())) {
                customServiceManager.saveServiceField('apiKey', value);
            } else {
                const stringKeyName = `${engineId}_keys_string`;
                GM_setValue(stringKeyName, value);
            }
            synchronizeAllSettings();
        };

        const resetDeleteButton = () => {
            glossaryManageDeleteBtn.textContent = '删除';
            glossaryManageDeleteBtn.removeAttribute('data-confirming');
        };

        const populateManageGlossary = () => {
            const metadata = GM_getValue(GLOSSARY_METADATA_KEY, {});
            const urls = Object.keys(metadata);
            const lastSelectedUrl = GM_getValue(LAST_SELECTED_GLOSSARY_KEY, null);

            glossaryManageSelect.innerHTML = '';

            if (urls.length === 0) {
                glossaryManageSelect.innerHTML = '<option value="" disabled selected>暂无术语表</option>';
                glossaryManageSelect.disabled = true;
                glossaryManageDetailsContainer.style.display = 'none';
            } else {
                urls.forEach(url => {
                    const filename = url.split('/').pop();
                    const lastDotIndex = filename.lastIndexOf('.');
                    const baseName = (lastDotIndex > 0) ? filename.substring(0, lastDotIndex) : filename;
                    const name = decodeURIComponent(baseName);
                    const option = document.createElement('option');
                    option.value = url;
                    option.textContent = name;
                    option.title = name;
                    glossaryManageSelect.appendChild(option);
                });
                glossaryManageSelect.disabled = false;

                if (lastSelectedUrl && urls.includes(lastSelectedUrl)) {
                    glossaryManageSelect.value = lastSelectedUrl;
                } else {
                    glossaryManageSelect.selectedIndex = 0;
                }
            }
            glossaryManageSelect.dispatchEvent(new Event('change'));
            resetDeleteButton();
        };

        const cleanupAllEmptyCustomServices = () => {
            const services = GM_getValue(CUSTOM_SERVICES_LIST_KEY, []);
            const servicesToKeep = services.filter(s => s.url || (s.models && s.models.length > 0));

            if (services.length !== servicesToKeep.length) {
                GM_setValue(CUSTOM_SERVICES_LIST_KEY, servicesToKeep);
                const currentEngine = GM_getValue('transEngine');
                const isCurrentEngineRemoved = !servicesToKeep.some(s => s.id === currentEngine);

                if (isCurrentEngineRemoved && currentEngine.startsWith('custom_')) {
                    GM_setValue('transEngine', 'google_translate');
                }
            }
        };

        const handleExport = async () => {
            try {
                const data = await exportAllData();
                const jsonString = JSON.stringify(data, null, 2);
                const blob = new Blob([jsonString], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                const shanghaiDate = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 10);
                a.download = `AO3-Chinese-Plugin-Backup-${shanghaiDate}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                notifyAndLog("配置已成功导出！");
            } catch (e) {
                if (DEBUG_MODE) {
                    console.error("导出失败:", e);
                }
                notifyAndLog("导出失败，请查看控制台获取详情。", "导出错误", "error");
            }
        };

        const handleImport = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;

                if (!window.confirm("您确定要导入该配置文件吗？这将覆盖您当前的所有设置，包括 API Key 、术语表、自定义翻译服务等。\n注意：此操作无法撤销。")) {
                    return;
                }

                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const jsonData = JSON.parse(event.target.result);
                        const result = await importAllData(jsonData, syncPanelState);
                        notifyAndLog(result.message, result.success ? "导入成功" : "导入失败", result.success ? "info" : "error");
                    } catch (err) {
                        if (DEBUG_MODE) {
                            console.error("导入失败:", err);
                        }
                        notifyAndLog(`导入失败：${err.message}`, "导入错误", "error");
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        };

        const togglePanel = () => {
            const isOpening = panel.style.display !== 'block';
            if (isOpening) {
                editableSections.forEach(s => s.style.display = 'none');
                dataSyncActionsContainer.style.display = 'none';
                syncPanelState();

                const lastAction = GM_getValue(GLOSSARY_ACTION_KEY, '');
                glossaryActionsSelect.value = lastAction;
                if (lastAction) {
                    glossaryActionsSelect.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    glossaryActionsSelect.value = "";
                }

                panel.style.display = 'block';
                updatePanelPosition();
            } else {
                if (customServiceManager.isPending()) {
                    customServiceManager.cancelPending();
                }
                cleanupAllEmptyCustomServices();
                panel.style.display = 'none';
                if (onPanelCloseCallback) onPanelCloseCallback();
            }
            if (rerenderMenuCallback) rerenderMenuCallback();
        };

        panel.addEventListener('change', (e) => {
            if (e.target.classList.contains('settings-control')) {
                updateInputLabel(e.target);
            }
        });
        panel.addEventListener('input', (e) => {
            if (e.target.classList.contains('settings-control')) {
                updateInputLabel(e.target);
            }
        });

        masterSwitch.addEventListener('change', () => {
            const isEnabled = masterSwitch.checked;
            GM_setValue('enable_transDesc', isEnabled);
            FeatureSet.enable_transDesc = isEnabled;
            syncPanelState();
            if (typeof fabLogic !== 'undefined' && fabLogic.toggleFabVisibility) {
                fabLogic.toggleFabVisibility();
            }
            if (isEnabled) transDesc();
            else {
                document.querySelectorAll('.translate-me-ao3-wrapper, .translated-by-ao3-script, .translated-by-ao3-script-error').forEach(el => el.remove());
                document.querySelectorAll('[data-translation-handled="true"], [data-state="translated"]').forEach(el => {
                    delete el.dataset.translationHandled;
                    delete el.dataset.state;
                });
            }
        });

        engineSelect.addEventListener('change', () => {
            if (customServiceManager.isPending()) {
                customServiceManager.cancelPending();
            }
            const newEngine = engineSelect.value;

            customServiceContainer.style.display = 'none';
            modelGroup.style.display = 'none';
            apiKeyGroup.style.display = 'none';

            if (newEngine === ADD_NEW_CUSTOM_SERVICE_ID) {
                customServiceManager.startPendingCreation();
            } else if (newEngine.startsWith('custom_')) {
                GM_setValue('transEngine', newEngine);
                customServiceManager.enterEditMode(newEngine);
            } else {
                GM_setValue('transEngine', newEngine);
                updateModelSelect(newEngine);
                updateApiKeySection(newEngine);
            }
            updateAllLabels();
        });

        modelSelect.addEventListener('change', () => {
            const engineId = engineSelect.value;
            if (engineId.startsWith('custom_')) {
                if (!modelSelect.disabled) {
                    GM_setValue(`${ACTIVE_MODEL_PREFIX_KEY}${engineId}`, modelSelect.value);
                }
            } else {
                const config = engineMenuConfig[engineId];
                if (config && config.modelGmKey) {
                    GM_setValue(config.modelGmKey, modelSelect.value);
                }
            }
        });

        displayModeSelect.addEventListener('change', () => {
            const newMode = displayModeSelect.value;
            GM_setValue('translation_display_mode', newMode);
            applyDisplayModeChange(newMode);
        });

        apiKeySaveBtn.addEventListener('click', saveApiKey);

        glossaryActionsSelect.addEventListener('change', () => {
            const action = glossaryActionsSelect.value;
            GM_setValue(GLOSSARY_ACTION_KEY, action);
            toggleEditableSection(null);

            switch (action) {
                case 'local':
                    glossaryLocalInput.value = GM_getValue(LOCAL_GLOSSARY_STRING_KEY, '');
                    toggleEditableSection(glossaryLocalSection);
                    break;
                case 'forbidden':
                    glossaryForbiddenInput.value = GM_getValue(LOCAL_FORBIDDEN_STRING_KEY, '');
                    toggleEditableSection(glossaryForbiddenSection);
                    break;
                case 'import':
                    glossaryImportUrlInput.value = '';
                    toggleEditableSection(glossaryImportSection);
                    break;
                case 'manage':
                    populateManageGlossary();
                    toggleEditableSection(glossaryManageSection);
                    break;
                case 'post_replace':
                    postReplaceInput.value = GM_getValue(POST_REPLACE_STRING_KEY, '');
                    toggleEditableSection(postReplaceSection);
                    break;
                case 'data_sync':
                    dataSyncActionsContainer.style.display = 'flex';
                    break;
                default:
                    break;
            }
        });

        glossaryLocalSaveBtn.addEventListener('click', () => {
            GM_setValue(LOCAL_GLOSSARY_STRING_KEY, glossaryLocalInput.value);
            synchronizeAllSettings();
        });

        glossaryForbiddenSaveBtn.addEventListener('click', () => {
            GM_setValue(LOCAL_FORBIDDEN_STRING_KEY, glossaryForbiddenInput.value);
            synchronizeAllSettings();
        });

        glossaryImportSaveBtn.addEventListener('click', () => {
            const url = glossaryImportUrlInput.value.trim();
            if (url) {
                importOnlineGlossary(url, () => {
                    if (glossaryActionsSelect.value === 'manage') {
                        populateManageGlossary();
                    }
                });
            }
        });

        glossaryManageSelect.addEventListener('change', () => {
            const url = glossaryManageSelect.value;
            if (url) {
                GM_setValue(LAST_SELECTED_GLOSSARY_KEY, url);
                const metadata = GM_getValue(GLOSSARY_METADATA_KEY, {})[url];
                glossaryManageInfo.textContent = `版本号：${metadata.version} ，维护者：${metadata.maintainer || '未知'}`;
                glossaryManageDetailsContainer.style.display = 'flex';
            } else {
                glossaryManageDetailsContainer.style.display = 'none';
            }
            resetDeleteButton();
        });

        glossaryManageDeleteBtn.addEventListener('click', () => {
            if (glossaryManageDeleteBtn.dataset.confirming) {
                const urlToRemove = glossaryManageSelect.value;
                if (urlToRemove) {
                    const allGlossaries = GM_getValue(IMPORTED_GLOSSARY_KEY, {});
                    const allMetadata = GM_getValue(GLOSSARY_METADATA_KEY, {});
                    delete allGlossaries[urlToRemove];
                    delete allMetadata[urlToRemove];
                    GM_setValue(IMPORTED_GLOSSARY_KEY, allGlossaries);
                    GM_setValue(GLOSSARY_METADATA_KEY, allMetadata);
                    invalidateGlossaryCache();
                    notifyAndLog(`已删除术语表: ${decodeURIComponent(urlToRemove.split('/').pop())}`);
                    populateManageGlossary();
                    updateInputLabel(glossaryManageSelect);
                }
            } else {
                glossaryManageDeleteBtn.textContent = '确认删除';
                glossaryManageDeleteBtn.setAttribute('data-confirming', 'true');
            }
        });

        postReplaceSaveBtn.addEventListener('click', () => {
            GM_setValue(POST_REPLACE_STRING_KEY, postReplaceInput.value);
            synchronizeAllSettings();
        });

        importDataBtn.addEventListener('click', () => handleImport(syncPanelState));
        exportDataBtn.addEventListener('click', handleExport);

        closeBtn.addEventListener('click', togglePanel);

        header.addEventListener('mousedown', (e) => {
            if (isMobile()) return;
            isDragging = true;
            panel.classList.add('dragging');
            origin = { x: e.clientX, y: e.clientY };
            startPosition = { x: panel.offsetLeft, y: panel.offsetTop };
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const newPos = {
                x: startPosition.x + e.clientX - origin.x,
                y: startPosition.y + e.clientY - origin.y
            };
            const correctedPos = ensureOnScreen(newPos, panel.getBoundingClientRect());
            panel.style.left = `${correctedPos.x}px`;
            panel.style.top = `${correctedPos.y}px`;
            repositionActiveDropdown();
        });
        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            panel.classList.remove('dragging');
            const finalPos = { x: panel.offsetLeft, y: panel.offsetTop };
            GM_setValue(PANEL_POSITION_KEY, finalPos);
        });

        const debouncedResizeHandler = debounce(() => {
            updatePanelPosition();
        }, 150);
        window.addEventListener('resize', debouncedResizeHandler);

        const handleClickOutside = (event) => {
            if (panel.style.display !== 'block') {
                return;
            }
            if (document.querySelector('.custom-dropdown-backdrop')) {
                return;
            }
            const fabContainer = document.getElementById('ao3-trans-fab-container');
            if (!panel.contains(event.target) && !(fabContainer && fabContainer.contains(event.target))) {
                togglePanel();
            }
        };
        document.addEventListener('mousedown', handleClickOutside, true);

        populateEngineSelect();
        syncPanelState();

        const repositionActiveDropdown = () => {
            if (!activeDropdown || !activeDropdown.menu || !activeDropdown.trigger) {
                return;
            }

            const { menu, trigger } = activeDropdown;
            const rect = trigger.getBoundingClientRect();

            menu.style.width = `${rect.width}px`;
            menu.style.top = `${rect.bottom + 4}px`;
            menu.style.left = `${rect.left}px`;

            const menuRect = menu.getBoundingClientRect();
            if (menuRect.right > window.innerWidth - 10) {
                menu.style.left = `${window.innerWidth - menuRect.width - 10}px`;
            }
            if (menuRect.bottom > window.innerHeight - 10) {
                menu.style.top = `${rect.top - menuRect.height - 4}px`;
                menu.style.transformOrigin = 'bottom center';
            } else {
                menu.style.transformOrigin = 'top center';
            }
        };

        function createCustomDropdown(triggerElement) {
            if (document.querySelector('.custom-dropdown-backdrop')) {
                return;
            }
            if (triggerElement.disabled || triggerElement.options.length === 0 || (triggerElement.options.length === 1 && triggerElement.options[0].disabled)) {
                return;
            }

            triggerElement.parentElement.classList.add('dropdown-active');

            const backdrop = document.createElement('div');
            backdrop.className = 'custom-dropdown-backdrop';
            document.body.appendChild(backdrop);

            const menu = document.createElement('div');
            menu.className = 'custom-dropdown-menu';
            const list = document.createElement('ul');
            menu.appendChild(list);

            const metadata = (triggerElement.id === 'setting-select-glossary-manage') ? GM_getValue(GLOSSARY_METADATA_KEY, {}) : null;

            const createListItem = (option) => {
                if (option.disabled) {
                    const separatorItem = document.createElement('li');
                    separatorItem.style.textAlign = 'center';
                    separatorItem.style.color = '#ccc';
                    separatorItem.style.cursor = 'default';
                    separatorItem.textContent = option.textContent;
                    return separatorItem;
                }

                const listItem = document.createElement('li');
                listItem.dataset.value = option.value;
                if (option.selected) {
                    listItem.classList.add('selected');
                }

                const textSpan = document.createElement('span');
                textSpan.className = 'item-text';
                textSpan.textContent = option.textContent;
                textSpan.title = option.textContent;
                listItem.appendChild(textSpan);

                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'item-actions';

                if (triggerElement.id === 'setting-select-glossary-manage' && metadata && metadata[option.value]) {
                    const toggleBtn = document.createElement('button');
                    toggleBtn.className = 'item-action-btn toggle-glossary';
                    const isEnabled = metadata[option.value].enabled !== false;
                    toggleBtn.textContent = isEnabled ? '禁用' : '启用';
                    toggleBtn.dataset.url = option.value;
                    actionsDiv.appendChild(toggleBtn);
                }

                if (option.dataset.isCustom === 'true') {
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'item-action-btn delete';
                    deleteBtn.textContent = '删除';
                    deleteBtn.dataset.serviceId = option.value;
                    actionsDiv.appendChild(deleteBtn);
                }
                listItem.appendChild(actionsDiv);
                return listItem;
            };

            Array.from(triggerElement.options).forEach(option => {
                const item = createListItem(option);
                if (item) list.appendChild(item);
            });

            document.body.appendChild(menu);
            activeDropdown = { menu: menu, trigger: triggerElement };
            repositionActiveDropdown();

            const selectedItem = list.querySelector('.selected');
            if (selectedItem) {
                selectedItem.scrollIntoView({ block: 'center', behavior: 'instant' });
            }

            requestAnimationFrame(() => {
                menu.classList.add('visible');
            });

            const closeMenu = () => {
                triggerElement.parentElement.classList.remove('dropdown-active');
                menu.classList.remove('visible');
                backdrop.remove();
                setTimeout(() => menu.remove(), 200);
                activeDropdown = null;
            };

            list.addEventListener('click', (e) => {
                const target = e.target;
                e.stopPropagation();

                if (target.classList.contains('toggle-glossary')) {
                    const url = target.dataset.url;
                    const currentMetadata = GM_getValue(GLOSSARY_METADATA_KEY, {});
                    if (currentMetadata[url]) {
                        const currentState = currentMetadata[url].enabled !== false;
                        currentMetadata[url].enabled = !currentState;
                        GM_setValue(GLOSSARY_METADATA_KEY, currentMetadata);
                        invalidateGlossaryCache();
                        target.textContent = !currentState ? '禁用' : '启用';
                    }
                } else if (target.classList.contains('delete')) {
                    if (target.dataset.confirming) {
                        const serviceId = target.dataset.serviceId;
                        customServiceManager.deleteService(serviceId);
                        closeMenu();
                    } else {
                        list.querySelectorAll('.delete[data-confirming]').forEach(btn => {
                            btn.textContent = '删除';
                            delete btn.dataset.confirming;
                        });
                        target.textContent = '确认删除';
                        target.dataset.confirming = 'true';
                    }
                } else {
                    const li = target.closest('li');
                    if (li && typeof li.dataset.value !== 'undefined') {
                        triggerElement.value = li.dataset.value;
                        triggerElement.dispatchEvent(new Event('change', { bubbles: true }));
                        closeMenu();
                    }
                }
            });

            backdrop.addEventListener('mousedown', closeMenu);
        }

        panel.addEventListener('mousedown', (e) => {
            const select = e.target.closest('.settings-select.custom-styled-select');
            if (select) {
                e.preventDefault();
                createCustomDropdown(select);
            }
        });

        customServiceContainer.addEventListener('mousedown', (e) => {
            const select = e.target.closest('.settings-select.custom-styled-select');
            if (select) {
                e.preventDefault();
                createCustomDropdown(select);
            }
        });

        customServiceContainer.addEventListener('change', (e) => {
            if (e.target.id === 'custom-service-action-select') {
                const serviceId = engineSelect.value;
                const newAction = e.target.value;

                if (serviceId && serviceId.startsWith('custom_')) {
                    const lastActionKey = `custom_service_last_action_${serviceId}`;
                    GM_setValue(lastActionKey, newAction);
                    customServiceManager.enterEditMode(serviceId);
                } else if (customServiceManager.isPending()) {
                    customServiceManager.updatePendingSection(newAction);
                }
            }
        });

        return { togglePanel, panel };
    }

    /**
     * 设置面板的 UI 配置
     */
    const engineMenuConfig = {
        'google_translate': {
            displayName: '谷歌翻译',
            modelGmKey: null,
            requiresApiKey: false
        },
        'openai': {
            displayName: 'OpenAI',
            modelGmKey: 'openai_model',
            modelMapping: {
                "gpt-5-chat-2025-01-01-preview": "GPT-5 Preview-2025-01-01",
                "gpt-5": "GPT-5",
                "gpt-5-chat": "GPT-5 Chat",
                "gpt-5-mini": "GPT-5 Mini",
                "gpt-5-nano": "GPT-5 Nano",
                "gpt-4.5-preview-2025-02-27": "GPT-4.5 Preview-2025-02-27",
                "gpt-4.5-preview": "GPT-4.5 Preview",
                "gpt-4.1-2025-04-14": "GPT-4.1-2025-04-14",
                "gpt-4.1": "GPT-4.1",
                "gpt-4.1-mini-2025-04-14": "GPT-4.1 Mini-2025-04-14",
                "gpt-4.1-mini": "GPT-4.1 Mini",
                "gpt-4.1-nano-2025-04-14": "GPT-4.1 Nano-2025-04-14",
                "gpt-4.1-nano": "GPT-4.1 Nano",
                "gpt-4o-2024-11-20": "GPT-4o-2024-11-20",
                "gpt-4o-2024-08-06": "GPT-4o-2024-08-06",
                "gpt-4o-2024-05-13": "GPT-4o-2024-05-13",
                "gpt-4o": "GPT-4o",
                "chatgpt-4o-latest": "ChatGPT 4o-Latest",
                "gpt-4o-mini-2024-07-18": "GPT-4o Mini-2024-07-18",
                "gpt-4o-mini": "GPT-4o Mini",
                "gpt-4-turbo-2024-04-09": "GPT-4 Turbo-2024-04-09",
                "gpt-4-turbo": "GPT-4 Turbo",
                "gpt-4-turbo-preview": "GPT-4 Turbo Preview",
                "gpt-4-1106-preview": "GPT-4 Turbo Preview-1106",
                "gpt-4-vision-preview": "GPT-4 Vision Preview",
                "gpt-4-32k-0613": "GPT-4-32k-0613",
                "gpt-4-32k": "GPT-4-32k",
                "gpt-4-0613": "GPT-4-0613",
                "gpt-4": "GPT-4",
                "gpt-3.5-turbo-0125": "GPT-3.5 Turbo-0125",
                "gpt-3.5-turbo-1106": "GPT-3.5 Turbo-1106",
                "gpt-3.5-turbo": "GPT-3.5 Turbo",
                "o4-mini": "o4-mini",
                "o3": "o3",
                "o3-mini": "o3-mini",
                "o1-preview": "o1-preview",
                "o1-mini": "o1-mini",
                "dall-e-3": "DALL-E 3"
            },
            requiresApiKey: true
        },
        'anthropic': {
            displayName: 'Anthropic',
            modelGmKey: 'anthropic_model',
            modelMapping: {
                "claude-opus-4-1-20250805": "Claude 4.1 Opus-2025-08-05",
                "claude-opus-4-1-latest": "Claude 4.1 Opus-Latest",
                "claude-opus-4-20250522": "Claude 4 Opus",
                "claude-sonnet-4-20250514": "Claude 4 Sonnet-2025-05-14",
                "claude-sonnet-4-latest": "Claude 4 Sonnet-Latest",
                "claude-3-7-sonnet-20250219": "Claude 3.7 Sonnet",
                "claude-3-5-sonnet-20241022": "Claude 3.5 Sonnet-2024-10-22",
                "claude-3-5-sonnet-latest": "Claude 3.5 Sonnet-Latest",
                "claude-3-5-haiku-20241022": "Claude 3.5 Haiku-2024-10-22",
                "claude-3-5-haiku-latest": "Claude 3.5 Haiku-Latest",
                "claude-3-opus-20240229": "Claude 3 Opus-2024-02-29",
                "claude-3-opus-latest": "Claude 3 Opus-Latest",
                "claude-3-sonnet-20240229": "Claude 3 Sonnet",
                "claude-3-haiku-20240307": "Claude 3 Haiku"
            },
            requiresApiKey: true
        },
        'zhipu_ai': {
            displayName: 'Zhipu AI',
            modelGmKey: null,
            requiresApiKey: true
        },
        'deepseek_ai': {
            displayName: 'DeepSeek',
            modelGmKey: 'deepseek_model',
            modelMapping: {
                'deepseek-reasoner': 'DeepSeek V3.1 Think',
                'deepseek-chat': 'DeepSeek V3.1 Non-Think'
            },
            requiresApiKey: true
        },
        'google_ai': {
            displayName: 'Google AI',
            modelGmKey: 'google_ai_model',
            modelMapping: {
                'gemini-2.5-pro': 'Gemini 2.5 Pro',
                'gemini-2.5-flash': 'Gemini 2.5 Flash',
                'gemini-2.5-flash-lite': 'Gemini 2.5 Flash-Lite'
            },
            requiresApiKey: true
        },
        'groq_ai': {
            displayName: 'Groq AI',
            modelGmKey: 'groq_model',
            modelMapping: {
                'meta-llama/llama-4-maverick-17b-128e-instruct': 'Llama 4',
                'moonshotai/kimi-k2-instruct': 'Kimi K2',
                'deepseek-r1-distill-llama-70b': 'DeepSeek 70B',
                'openai/gpt-oss-120b': 'GPT-OSS 120B'
            },
            requiresApiKey: true
        },
        'together_ai': {
            displayName: 'Together AI',
            modelGmKey: 'together_model',
            modelMapping: {
                'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8': 'Llama 4',
                'deepseek-ai/DeepSeek-V3': 'DeepSeek V3',
                'Qwen/Qwen3-235B-A22B-Instruct-2507-tput': 'Qwen3 235B'
            },
            requiresApiKey: true
        },
        'cerebras_ai': {
            displayName: 'Cerebras',
            modelGmKey: 'cerebras_model',
            modelMapping: {
                'llama-4-maverick-17b-128e-instruct': 'Llama 4',
                'qwen-3-235b-a22b-instruct-2507': 'Qwen 3 235B',
                'gpt-oss-120b': 'GPT-OSS 120B'
            },
            requiresApiKey: true
        },
        'modelscope_ai': {
            displayName: 'ModelScope',
            modelGmKey: 'modelscope_model',
            modelMapping: {
                'LLM-Research/Llama-4-Maverick-17B-128E-Instruct': 'Llama 4',
                'deepseek-ai/DeepSeek-V3': 'DeepSeek V3',
                'ZhipuAI/GLM-4.5': 'GLM 4.5',
                'moonshotai/Kimi-K2-Instruct': 'Kimi K2',
                'Qwen/Qwen3-235B-A22B-Instruct-2507': 'Qwen3 235B'
            },
            requiresApiKey: true
        },
        'add_new_custom': {
            displayName: '自定义',
            modelGmKey: null,
            requiresApiKey: false
        }
    };

    /**
     * 动态应用翻译显示模式的更改
     */
    function applyDisplayModeChange(mode) {
        const originalUnits = document.querySelectorAll('[data-translation-state="translated"]');
        originalUnits.forEach(unit => {
            const nextSibling = unit.nextElementSibling;
            if (nextSibling && (nextSibling.classList.contains('translated-by-ao3-script') || nextSibling.classList.contains('translated-by-ao3-script-error'))) {
                unit.style.display = (mode === 'translation_only') ? 'none' : '';
            }
        });
    }

    /****************** 谷歌翻译模块 ******************/
    // The following GoogleTranslateHelper object incorporates logic adapted from the
    // "Traduzir-paginas-web" project by FilipePS, which is licensed under the MPL-2.0.
    // Original source: https://github.com/FilipePS/Traduzir-paginas-web
    // A copy of the MPL-2.0 license is included in this project's repository.
    //
    // 下方的 GoogleTranslateHelper 对象整合了源自 FilipePS 的“Traduzir-paginas-web”项目的代码逻辑，
    // 该项目使用 MPL-2.0 许可证。
    // 原始项目地址: https://github.com/FilipePS/Traduzir-paginas-web
    // MPL-2.0 许可证的副本已包含在本项目仓库中。
    const GoogleTranslateHelper  = {
        lastRequestAuthTime: null,
        translateAuth: null,
        authPromise: null,

        unescapeHTML: function(unsafe) {
            return unsafe
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");
        },

        findAuth: async function() {
            if (this.authPromise) return this.authPromise;

            this.authPromise = new Promise((resolve) => {
                let needsUpdate = false;
                if (this.lastRequestAuthTime) {
                    const now = new Date();
                    const threshold = new Date(this.lastRequestAuthTime);
                    threshold.setMinutes(threshold.getMinutes() + 20);
                    if (now > threshold) {
                        needsUpdate = true;
                    }
                } else {
                    needsUpdate = true;
                }

                if (needsUpdate) {
                    this.lastRequestAuthTime = Date.now();
                    GM_xmlhttpRequest({
                        method: "GET",
                        url: "https://translate.googleapis.com/_/translate_http/_/js/k=translate_http.tr.en_US.YusFYy3P_ro.O/am=AAg/d=1/exm=el_conf/ed=1/rs=AN8SPfq1Hb8iJRleQqQc8zhdzXmF9E56eQ/m=el_main",
                        onload: (response) => {
                            if (response.status === 200 && response.responseText) {
                                const result = response.responseText.match(/['"]x-goog-api-key['"]\s*:\s*['"](\w{39})['"]/i);
                                if (result && result[1]) {
                                    this.translateAuth = result[1];
                                }
                            }
                            resolve();
                        },
                        onerror: () => resolve(),
                        ontimeout: () => resolve()
                    });
                } else {
                    resolve();
                }
            });

            try {
                await this.authPromise;
            } finally {
                this.authPromise = null;
            }
        }
    };

	/**
     * 获取当前有效翻译引擎的名称
     */
	function getValidEngineName() {
		const storedEngine = GM_getValue('transEngine');
		if (storedEngine && (CONFIG.TRANS_ENGINES[storedEngine] || storedEngine.startsWith('custom_'))) {
			return storedEngine;
		}
		return CONFIG.transEngine;
	}

    /**
     * 远程翻译请求函数
     */
	async function requestRemoteTranslation(paragraphs, { retryCount = 0, maxRetries = 5 } = {}) {
		const engineName = getValidEngineName();

		let engineConfig = CONFIG.TRANS_ENGINES[engineName];

		if (!engineConfig && engineName.startsWith('custom_')) {
			engineConfig = {
				name: '自定义服务',
				method: 'POST',
				getRequestData: (paragraphs, engineName) => {
					const model = getCurrentModelId(engineName);
					return createRequestData(model, sharedSystemPrompt, paragraphs);
				},
				responseIdentifier: 'choices[0].message.content',
			};
		}

		if (!engineConfig) {
			console.error(`%c[翻译流程] 错误: 未找到服务配置。`, `服务 "${engineName}" 未配置。`, paragraphs);
			throw new Error(`服务 ${engineName} 未配置`);
		}

		try {
			let translatedText;

            switch (engineName) {
                case 'google_translate':
                    const translatedHtmlSnippets = await _handleGoogleRequest(engineConfig, paragraphs);
                    if (!Array.isArray(translatedHtmlSnippets)) {
                        throw new Error('谷歌翻译接口未返回预期的数组格式');
                    }
                    const innerContents = translatedHtmlSnippets.map(html => {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = html;
                        return tempDiv.firstElementChild ? tempDiv.firstElementChild.innerHTML : '';
                    });
                    translatedText = innerContents.map((content, index) => `${index + 1}. ${content}`).join('\n\n');
                    break;
                case 'openai':
                    translatedText = await _handleOpenaiRequest(engineConfig, paragraphs, engineName);
                    break;
                case 'anthropic':
                    translatedText = await _handleAnthropicRequest(engineConfig, paragraphs, engineName);
                    break;
                case 'google_ai':
                    translatedText = await _handleGoogleAiRequest(engineConfig, paragraphs, engineName);
                    break;
                default:
                    translatedText = await _handleStandardApiRequest(engineConfig, paragraphs, engineName);
                    break;
            }
			
			if (typeof translatedText !== 'string' || !translatedText.trim()) {
				throw new Error('API 未返回有效文本');
			}
			
			return translatedText;

		} catch (error) {
            console.error(`%c[翻译流程] 错误: 在第 ${retryCount + 1} 次尝试中捕获到错误。`, 'color: red;', error);

            if (error.noRetry) {
                throw error;
            }

			const isRetriable =
                error.type === 'server_overloaded' ||
                error.type === 'rate_limit' ||
                error.type === 'network' ||
                error.type === 'timeout' ||
                error.message.includes('超时') ||
                error.message.includes('网络') ||
                error.message === 'API 未返回有效文本';

			if (retryCount < maxRetries && isRetriable) {
				const delay = Math.pow(2, retryCount) * 1500 + Math.random() * 1000;
				await sleep(delay);
				return await requestRemoteTranslation(paragraphs, { retryCount: retryCount + 1, maxRetries });
			}
			throw error;
		}
	}

    /**
     * 为指定服务获取下一个可用的 API Key，包含轮询和跨标签页锁机制
     */
    async function _getApiKeyForService(serviceName) {
        const arrayKey = `${serviceName}_keys_array`;
        const keys = GM_getValue(arrayKey, []);

        if (keys.length === 0) {
            const serviceDisplayName = engineMenuConfig[serviceName]?.displayName || serviceName;
            const error = new Error(`请先在设置面板中为“${serviceDisplayName}”服务设置至少一个 API Key`);
            error.noRetry = true;
            throw error;
        }

        const lockKey = `${serviceName}_key_lock`;
        const LOCK_TIMEOUT = 5000;
        const myLockId = `lock_${Date.now()}_${Math.random()}`;

        async function acquireLock() {
            const startTime = Date.now();
            while (Date.now() - startTime < LOCK_TIMEOUT) {
                const currentLock = GM_getValue(lockKey, null);
                if (!currentLock || (Date.now() - currentLock.timestamp > LOCK_TIMEOUT)) {
                    GM_setValue(lockKey, { id: myLockId, timestamp: Date.now() });
                    await sleep(50);
                    const confirmedLock = GM_getValue(lockKey, null);
                    if (confirmedLock && confirmedLock.id === myLockId) {
                        return true;
                    }
                }
                await sleep(100 + Math.random() * 100);
            }
            return false;
        }

        function releaseLock() {
            const currentLock = GM_getValue(lockKey, null);
            if (currentLock && currentLock.id === myLockId) {
                GM_deleteValue(lockKey);
            }
        }

        if (!(await acquireLock())) {
            throw new Error(`获取 ${serviceName} API Key 的操作锁超时，请稍后重试。`);
        }

        try {
            const indexKey = `${serviceName}_key_index`;
            const startIndex = GM_getValue(indexKey, 0);
            const currentIndex = startIndex % keys.length;
            GM_setValue(indexKey, (startIndex + 1) % keys.length);

            const currentKey = keys[currentIndex];
            return { key: currentKey, index: currentIndex };
        } finally {
            releaseLock();
        }
    }

    /**
     * 处理 Google AI 的 API 请求，通过调用 Key 获取函数实现轮询
     */
    async function _handleGoogleAiRequest(engineConfig, paragraphs, engineName) {
        const { key: currentKey, index: currentIndex } = await _getApiKeyForService(engineName);

        const modelId = getCurrentModelId(engineName);
        const final_url = engineConfig.url_api.replace('{model}', modelId) + `?key=${currentKey}`;
        const requestData = engineConfig.getRequestData(paragraphs, engineName);

        try {
            const result = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: engineConfig.method, url: final_url, headers: engineConfig.headers,
                    data: JSON.stringify(requestData), responseType: 'json', timeout: 45000,
                    onload: (res) => {
                        let responseData = res.response;
                        if (typeof responseData === 'string') try { responseData = JSON.parse(responseData); } catch(e) {}

                        const candidate = getNestedProperty(responseData, 'candidates[0]');
                        const translatedText = getNestedProperty(candidate, 'content.parts[0].text');
                        const finishReason = getNestedProperty(candidate, 'finishReason');
                        const errorMessage = getNestedProperty(responseData, 'error.message') || res.statusText || '未知错误';

                        if (res.status === 200 && translatedText) {
                            resolve(responseData);
                        } else {
                            let errorType = 'api_error';
                            let message = `Key #${currentIndex + 1} 遇到错误（代码：${res.status}）：${errorMessage}`;

                            if (res.status === 200) {
                                if (['SAFETY', 'RECITATION', 'PROHIBITED_CONTENT'].includes(finishReason)) {
                                    errorType = 'content_error';
                                    message = `因 ${finishReason} 原因，请求被 Google AI 安全策略阻止`;
                                } else {
                                    errorType = 'empty_response';
                                    message = `Key #${currentIndex + 1} 失败：API 返回了空内容 (FinishReason: ${finishReason})`;
                                }
                            } else if (res.status === 400 && errorMessage.toLowerCase().includes('api key not valid')) {
                                errorType = 'key_invalid';
                                message = `Key #${currentIndex + 1} 无效`;
                            }

                            reject({ type: errorType, message: message, res: res });
                        }
                    },
                    onerror: () => reject({ type: 'network', message: `Key #${currentIndex + 1} 网络错误` }),
                    ontimeout: () => reject({ type: 'network', message: `Key #${currentIndex + 1} 请求超时` })
                });
            });
            return getNestedProperty(result, engineConfig.responseIdentifier);
        } catch (errorData) {
            throw _handleGoogleAiError({ ...errorData, name: engineConfig.name });
        }
    }

    /**
     * 处理对谷歌翻译接口的特定请求流程
     */
    async function _handleGoogleRequest(engineConfig, paragraphs) {
        await GoogleTranslateHelper .findAuth();
        if (!GoogleTranslateHelper .translateAuth) {
            throw new Error('无法获取谷歌翻译的授权凭证');
        }

        const headers = {
            ...engineConfig.headers,
            'X-goog-api-key': GoogleTranslateHelper .translateAuth
        };
        const requestData = engineConfig.getRequestData(paragraphs);

        const res = await new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: engineConfig.method,
                url: engineConfig.url_api,
                headers: headers,
                data: requestData,
                responseType: 'json',
                timeout: 45000,
                onload: resolve,
                onerror: () => reject(new Error('网络请求错误')),
                ontimeout: () => reject(new Error('请求超时'))
            });
        });

        if (res.status !== 200) {
            throw new Error(`谷歌翻译 API 错误 (代码: ${res.status}): ${res.statusText}`);
        }

        const translatedHtmlSnippets = getNestedProperty(res.response, '0');
        if (!translatedHtmlSnippets || !Array.isArray(translatedHtmlSnippets)) {
            throw new Error('从谷歌翻译接口返回的响应结构无效');
        }

        return translatedHtmlSnippets;
    }

    /**
     * 处理对 OpenAI API 的请求
     */
    async function _handleOpenaiRequest(engineConfig, paragraphs, engineName) {
        const { key: apiKey, index: keyIndex } = await _getApiKeyForService(engineName);
        const modelId = getCurrentModelId(engineName);

        const requestData = {
            model: modelId,
            messages: [
                { "role": "system", "content": sharedSystemPrompt },
                { "role": "user", "content": paragraphs.map((p, i) => `${i + 1}. ${p.innerHTML}`).join('\n\n') }
            ],
            stream: false,
            temperature: 1.0,
        };

        const res = await new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: engineConfig.method,
                url: engineConfig.url_api,
                headers: { ...engineConfig.headers, 'Authorization': `Bearer ${apiKey}` },
                data: JSON.stringify(requestData),
                responseType: 'json',
                timeout: 45000,
                onload: resolve,
                onerror: () => reject(new Error(`Key #${keyIndex + 1} 网络请求错误`)),
                ontimeout: () => reject(new Error(`Key #${keyIndex + 1} 请求超时`))
            });
        });

        if (res.status !== 200) {
            let responseData = res.response;
            if (typeof responseData === 'string') try { responseData = JSON.parse(responseData); } catch (e) {}
            throw _handleOpenaiError(res, engineConfig.name, responseData);
        }

        return getNestedProperty(res.response, 'choices[0].message.content');
    }

    /**
     * 处理对 Anthropic API 的请求
     */
    async function _handleAnthropicRequest(engineConfig, paragraphs, engineName) {
        const { key: apiKey, index: keyIndex } = await _getApiKeyForService(engineName);
        const modelId = getCurrentModelId(engineName);

        const requestData = {
            model: modelId,
            system: sharedSystemPrompt,
            messages: [
                { "role": "user", "content": paragraphs.map((p, i) => `${i + 1}. ${p.innerHTML}`).join('\n\n') }
            ],
            stream: false,
            temperature: 1.0,
            max_tokens: 4096,
        };

        const res = await new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: engineConfig.method,
                url: engineConfig.url_api,
                headers: { ...engineConfig.headers, 'x-api-key': apiKey },
                data: JSON.stringify(requestData),
                responseType: 'json',
                timeout: 45000,
                onload: resolve,
                onerror: () => reject(new Error(`Key #${keyIndex + 1} 网络请求错误`)),
                ontimeout: () => reject(new Error(`Key #${keyIndex + 1} 请求超时`))
            });
        });

        if (res.status !== 200) {
            let responseData = res.response;
            if (typeof responseData === 'string') try { responseData = JSON.parse(responseData); } catch (e) {}
            throw _handleAnthropicError(res, engineConfig.name, responseData);
        }

        return getNestedProperty(res.response, 'content[0].text');
    }

    /**
     * 处理标准 Bearer Token 认证的 API 请求，通过调用通用 Key 获取函数实现轮询
     */
	async function _handleStandardApiRequest(engineConfig, paragraphs, engineName) {
		const { name, method, responseIdentifier, getRequestData } = engineConfig;

		let headers = { ...engineConfig.headers };
        let finalUrl;

        const { key: apiKey, index: keyIndex } = await _getApiKeyForService(engineName);
        const serviceDisplayName = (engineMenuConfig[engineName]?.displayName) ||
                                   (GM_getValue(CUSTOM_SERVICES_LIST_KEY, []).find(s => s.id === engineName)?.name) ||
                                   engineName;

        if (engineName.startsWith('custom_')) {
            const services = GM_getValue(CUSTOM_SERVICES_LIST_KEY, []);
            const service = services.find(s => s.id === engineName);
            finalUrl = service ? service.url : null;
        } else {
            finalUrl = engineConfig.url_api;
        }

        if (!finalUrl) {
            const error = new Error(`请先为服务“${serviceDisplayName}”设置接口地址`);
            error.noRetry = true;
            throw error;
        }

        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

		const requestData = getRequestData(paragraphs, engineName);

		const res = await new Promise((resolve, reject) => {
			GM_xmlhttpRequest({
				method, url: finalUrl, headers, data: JSON.stringify(requestData),
				responseType: 'json', timeout: 45000,
				onload: resolve,
				onerror: () => reject(new Error(`Key #${keyIndex + 1} 网络请求错误`)),
				ontimeout: () => reject(new Error(`Key #${keyIndex + 1} 请求超时`))
			});
		});

		if (res.status !== 200) {
			let responseData = res.response;
			if (typeof responseData === 'string') try { responseData = JSON.parse(responseData); } catch (e) {}

            const errorHandler = API_ERROR_HANDLERS[engineName] || _handleDefaultApiError;
            const error = errorHandler(res, name, responseData);

			throw error;
		}

		return getNestedProperty(res.response, responseIdentifier);
	}

    // API 错误处理策略注册表
    const API_ERROR_HANDLERS = {};

    /**
     * 默认 API 错误处理策略
     */
    function _handleDefaultApiError(res, name, responseData) {
        const apiErrorMessage = getNestedProperty(responseData, 'error.message') || getNestedProperty(responseData, 'message') || res.statusText;
        let userFriendlyError;
        const error = new Error();

        switch (res.status) {
            case 401:
                userFriendlyError = `API Key 无效或缺失 (401)：请在设置面板中检查您的 ${name} API Key 是否正确填写。`;
                error.noRetry = true;
                break;
            case 405:
                userFriendlyError = `方法不允许 (405)：您配置的接口地址不支持 POST 请求。请检查 URL 是否为完整的聊天补全端点（通常以 /chat/completions 结尾）。`;
                error.noRetry = true;
                break;
            case 429:
                userFriendlyError = `请求频率过高 (429)：已超出 API 的速率限制，脚本将在稍后自动重试。`;
                error.type = 'rate_limit';
                break;
            case 500:
            case 503:
                userFriendlyError = `服务器错误 (${res.status})：${name} 的服务器暂时不可用，脚本将在稍后自动重试。`;
                error.type = 'server_overloaded';
                break;
            default:
                userFriendlyError = `发生未知 API 错误 (代码: ${res.status})。`;
                error.noRetry = true;
                break;
        }

        error.message = userFriendlyError + `\n\n原始错误信息：\n${apiErrorMessage}`;
        return error;
    }

    /**
     * OpenAI 的专属错误处理策略
     */
    function _handleOpenaiError(res, name, responseData) {
        const apiErrorMessage = getNestedProperty(responseData, 'error.message') || res.statusText;
        const apiErrorCode = getNestedProperty(responseData, 'error.code');
        let userFriendlyError;
        const error = new Error();
        error.noRetry = false;

        switch (res.status) {
            case 400:
                if (apiErrorCode === 'model_not_found') {
                    userFriendlyError = `模型不存在 (400)：您选择的模型当前不可用或您无权访问。请在设置中更换模型。`;
                } else {
                    userFriendlyError = `错误的请求 (400)：请求的格式或参数有误。`;
                }
                error.noRetry = true;
                break;
            case 401:
                userFriendlyError = `API Key 无效或认证失败 (401)：请在设置面板中检查您的 ${name} API Key。`;
                error.noRetry = true;
                break;
            case 403:
                userFriendlyError = `权限被拒绝 (403)：您的 API Key 无权访问所请求的资源，或您所在的地区不受支持。`;
                error.noRetry = true;
                break;
            case 404:
                userFriendlyError = `资源未找到 (404)：请求的 API 端点不存在。`;
                error.noRetry = true;
                break;
            case 429:
                if (apiErrorCode === 'insufficient_quota') {
                    userFriendlyError = `账户余额不足 (429)：您的 ${name} 账户已用尽信用点数或达到支出上限。请前往 OpenAI 官网检查您的账单详情。`;
                    error.noRetry = true;
                } else {
                    userFriendlyError = `请求频率过高 (429)：已超出 API 的速率限制，脚本将在稍后自动重试。`;
                    error.type = 'rate_limit';
                }
                break;
            case 500:
                userFriendlyError = `服务器内部错误 (500)：${name} 的服务器遇到问题，脚本将在稍后自动重试。`;
                error.type = 'server_overloaded';
                break;
            case 503:
                if (apiErrorMessage.includes('Slow Down')) {
                    userFriendlyError = `服务暂时过载 (503 - Slow Down)：由于您的请求速率突然增加，服务暂时受到影响。请稍等片刻，脚本将自动重试。`;
                } else {
                    userFriendlyError = `服务器当前过载 (503)：${name} 的服务器正经历高流量，脚本将在稍后自动重试。`;
                }
                error.type = 'server_overloaded';
                break;
            default:
                userFriendlyError = `发生未知 API 错误 (代码: ${res.status})。`;
                error.noRetry = true;
                break;
        }

        error.message = userFriendlyError + `\n\n原始错误信息：\n${apiErrorMessage}`;
        return error;
    }

    /**
     * Anthropic 的专属错误处理策略
     */
    function _handleAnthropicError(res, name, responseData) {
        const apiErrorType = getNestedProperty(responseData, 'error.type');
        const apiErrorMessage = getNestedProperty(responseData, 'error.message') || res.statusText;
        let userFriendlyError;
        const error = new Error();
        error.noRetry = false;

        switch (apiErrorType) {
            case 'invalid_request_error':
                userFriendlyError = `无效请求 (${res.status})：请求的格式或参数有误。如果问题持续，可能是模型名称不受支持或已更新。`;
                error.noRetry = true;
                break;
            case 'authentication_error':
                userFriendlyError = `API Key 无效或认证失败 (401)：请在设置面板中检查您的 ${name} API Key。`;
                error.noRetry = true;
                break;
            case 'permission_error':
                userFriendlyError = `权限被拒绝 (403)：您的 API Key 无权访问所请求的资源。`;
                error.noRetry = true;
                break;
            case 'not_found_error':
                userFriendlyError = `资源未找到 (404)：请求的 API 端点或模型不存在。`;
                error.noRetry = true;
                break;
            case 'request_too_large':
                userFriendlyError = `请求内容过长 (413)：发送的文本量超过了 API 的单次请求上限。`;
                error.noRetry = true;
                break;
            case 'rate_limit_error':
                userFriendlyError = `请求频率过高 (429)：已超出 API 的速率限制，脚本将在稍后自动重试。`;
                error.type = 'rate_limit';
                break;
            case 'api_error':
                userFriendlyError = `服务器内部错误 (500)：${name} 的服务器遇到问题，脚本将在稍后自动重试。`;
                error.type = 'server_overloaded';
                break;
            case 'overloaded_error':
                userFriendlyError = `服务器过载 (529)：${name} 的服务器当前负载过高，脚本将在稍后自动重试。`;
                error.type = 'server_overloaded';
                break;
            default:
                if (res.status === 413) {
                    userFriendlyError = `请求内容过长 (413)：发送的文本量超过了 API 的单次请求上限。`;
                } else {
                    userFriendlyError = `发生未知 API 错误 (代码: ${res.status})。`;
                }
                error.noRetry = true;
                break;
        }

        error.message = userFriendlyError + `\n\n原始错误信息：\n${apiErrorMessage}`;
        return error;
    }

    /**
     * Zhipu AI 的专属错误处理策略
     */
    function _handleZhipuAiError(res, name, responseData) {
        const businessErrorCode = getNestedProperty(responseData, 'error.code');
        const apiErrorMessage = getNestedProperty(responseData, 'error.message') || res.statusText;
        let userFriendlyError;
        const error = new Error();

        if (businessErrorCode) {
            switch (businessErrorCode) {
                case '1001':
                case '1002':
                case '1003':
                case '1004':
                    userFriendlyError = `API Key 无效或认证失败 (${businessErrorCode})：请在设置面板中检查您的 ${name} API Key 是否正确填写。`;
                    error.noRetry = true;
                    break;
                case '1112':
                    userFriendlyError = `账户异常 (${businessErrorCode})：您的 ${name} 账户已被锁定，请联系平台客服。`;
                    error.noRetry = true;
                    break;
                case '1113':
                    userFriendlyError = `账户余额不足 (${businessErrorCode})：您的 ${name} 账户已欠费，请前往 Zhipu AI 官网充值。`;
                    error.noRetry = true;
                    break;
                case '1301':
                    userFriendlyError = `内容安全策略阻止 (${businessErrorCode})：因含有敏感内容，请求被 Zhipu AI 安全策略阻止。`;
                    error.noRetry = true;
                    error.type = 'content_error';
                    break;
                case '1302':
                case '1303':
                    userFriendlyError = `请求频率过高 (${businessErrorCode})：已超出 API 的速率限制，脚本将在稍后自动重试。`;
                    error.type = 'rate_limit';
                    break;
                case '1304':
                    userFriendlyError = `调用次数超限 (${businessErrorCode})：已达到当日调用次数限额，请联系 Zhipu AI 客服。`;
                    error.noRetry = true;
                    break;
                default:
                    userFriendlyError = `发生未知的业务错误 (代码: ${businessErrorCode})。`;
                    error.noRetry = true;
                    break;
            }
        } else {
            switch (res.status) {
                case 401:
                    userFriendlyError = `API Key 无效或认证失败 (401)：请在设置面板中检查您的 ${name} API Key 是否正确填写。`;
                    error.noRetry = true;
                    break;
                case 429:
                    userFriendlyError = `请求频率过高 (429)：已超出 API 的速率限制，脚本将在稍后自动重试。`;
                    error.type = 'rate_limit';
                    break;
                case 500:
                    userFriendlyError = `服务器内部错误 (500)：${name} 的服务器遇到未知问题，脚本将在稍后自动重试。`;
                    error.type = 'server_overloaded';
                    break;
                default:
                    userFriendlyError = `发生未知 API 错误 (代码: ${res.status})。`;
                    error.noRetry = true;
                    break;
            }
        }

        error.message = userFriendlyError + `\n\n原始错误信息：\n${apiErrorMessage}`;
        return error;
    }

    /**
     * DeepSeek AI 的专属错误处理策略
     */
    function _handleDeepseekAiError(res, name, responseData) {
        const apiErrorMessage = getNestedProperty(responseData, 'error.message') || getNestedProperty(responseData, 'message') || res.statusText;
        let userFriendlyError;
        const error = new Error();

        switch (res.status) {
            case 400:
            case 422:
                userFriendlyError = `请求格式或参数错误 (${res.status})：请检查脚本是否为最新版本。如果问题持续，可能是 API 服务端出现问题。`;
                error.noRetry = true;
                break;
            case 401:
                userFriendlyError = `API Key 无效或认证失败 (401)：请在设置面板中检查您的 ${name} API Key 是否正确填写。`;
                error.noRetry = true;
                break;
            case 402:
                userFriendlyError = `账户余额不足 (402)：您的 ${name} 账户余额不足。请前往 DeepSeek 官网充值。`;
                error.noRetry = true;
                break;
            case 429:
                userFriendlyError = `请求频率过高 (429)：已超出 API 的速率限制，脚本将在稍后自动重试。`;
                error.type = 'rate_limit';
                break;
            case 500:
                userFriendlyError = `服务器内部故障 (500)：${name} 的服务器遇到未知问题，脚本将在稍后自动重试。`;
                error.type = 'server_overloaded';
                break;
            case 503:
                userFriendlyError = `服务器繁忙 (503)：${name} 的服务器当前负载过高，脚本将在稍后自动重试。`;
                error.type = 'server_overloaded';
                break;
            default:
                userFriendlyError = `发生未知 API 错误 (代码: ${res.status})。`;
                error.noRetry = true;
                break;
        }

        error.message = userFriendlyError + `\n\n原始错误信息：\n${apiErrorMessage}`;
        return error;
    }

    /**
     * Google AI 的专属错误处理策略
     */
    function _handleGoogleAiError(errorData) {
        const { type, message, res, name } = errorData;
        const error = new Error();
        let userFriendlyError;

        if (type === 'content_error') {
            userFriendlyError = `内容安全策略阻止：${message}。请尝试修改原文内容。`;
            error.noRetry = true;
        } else if (type === 'key_invalid') {
            userFriendlyError = `API Key 无效或认证失败：${message}。请在设置面板中检查您的 API Key。`;
            error.noRetry = true;
        } else if (res) {
            switch (res.status) {
                case 400:
                    userFriendlyError = `请求格式错误 (400)：您的国家/地区可能不支持 Gemini API 的免费套餐，请在 Google AI Studio 中启用结算。`;
                    error.noRetry = true;
                    break;
                case 403:
                    userFriendlyError = `权限被拒绝 (403)：您的 API Key 没有所需权限。请检查您的 API Key 设置。`;
                    error.noRetry = true;
                    break;
                case 404:
                    userFriendlyError = `资源未找到 (404)：请求中引用的资源（如模型名称）不存在。`;
                    error.noRetry = true;
                    break;
                case 429:
                    userFriendlyError = `请求频率过高 (429)：已超出 API 的速率限制，脚本将在稍后自动重试。`;
                    error.type = 'rate_limit';
                    break;
                case 500:
                    userFriendlyError = `服务器内部错误 (500)：Google 服务器遇到意外错误，脚本将在稍后自动重试。`;
                    error.type = 'server_overloaded';
                    break;
                case 503:
                    userFriendlyError = `服务不可用 (503)：${name} 的服务器暂时过载或不可用，脚本将在稍后自动重试。`;
                    error.type = 'server_overloaded';
                    break;
                default:
                    userFriendlyError = `发生未知 API 错误 (代码: ${res.status})。`;
                    error.noRetry = true;
                    break;
            }
        } else {
            userFriendlyError = `发生未知错误：${message}`;
            error.noRetry = (type !== 'network' && type !== 'timeout');
        }

        error.message = userFriendlyError + `\n\n原始错误信息：\n${message}`;
        return error;
    }

    /**
     * Together AI、Groq AI 的错误处理策略
     */
    function _handleTogetherAiError(res, name, responseData) {
        const apiErrorMessage = getNestedProperty(responseData, 'error.message') || getNestedProperty(responseData, 'message') || res.statusText;
        let userFriendlyError;
        const error = new Error();

        switch (res.status) {
            case 400:
            case 422:
                userFriendlyError = `请求格式或参数错误 (${res.status})：请检查脚本是否为最新版本。如果问题持续，可能是 API 服务端出现问题。`;
                error.noRetry = true;
                break;
            case 401:
                userFriendlyError = `API Key 无效或认证失败 (401)：请在设置面板中检查您的 ${name} API Key 是否正确填写。`;
                error.noRetry = true;
                break;
            case 402:
                userFriendlyError = `需要付费 (402)：您的 ${name} 账户已达到消费上限或需要充值。请检查您的账户账单设置。`;
                error.noRetry = true;
                break;
            case 403:
            case 413:
                userFriendlyError = `请求被拒绝 (${res.status})：这通常意味着输入内容过长，超过了模型的上下文长度限制。请尝试翻译更短的文本段落。`;
                error.noRetry = true;
                break;
            case 404:
                userFriendlyError = `模型或终结点不存在 (404)：您选择的模型名称可能已失效。请尝试在设置面板中切换至其她模型。`;
                error.noRetry = true;
                break;
            case 429:
                userFriendlyError = `请求频率过高 (429)：已超出 API 的速率限制，脚本将在稍后自动重试。`;
                error.type = 'rate_limit';
                break;
            case 500:
            case 502:
            case 503:
                userFriendlyError = `服务器错误 (${res.status})：${name} 的服务器暂时不可用，脚本将在稍后自动重试。`;
                error.type = 'server_overloaded';
                break;
            default:
                userFriendlyError = `发生未知 API 错误 (代码: ${res.status})。`;
                error.noRetry = true;
                break;
        }

        error.message = userFriendlyError + `\n\n原始错误信息：\n${apiErrorMessage}`;
        return error;
    }

    API_ERROR_HANDLERS['openai'] = _handleOpenaiError;
    API_ERROR_HANDLERS['anthropic'] = _handleAnthropicError;
    API_ERROR_HANDLERS['zhipu_ai'] = _handleZhipuAiError;
    API_ERROR_HANDLERS['deepseek_ai'] = _handleDeepseekAiError;
    API_ERROR_HANDLERS['groq_ai'] = _handleTogetherAiError;
    API_ERROR_HANDLERS['together_ai'] = _handleTogetherAiError;
    API_ERROR_HANDLERS['cerebras_ai'] = _handleTogetherAiError;

    /**
     * 为词形变体创建正则表达式
     */
    function createSmartRegexPattern(forms) {
        if (!forms || forms.size === 0) {
            return '';
        }

        const sortedForms = Array.from(forms).sort((a, b) => b.length - a.length);

        const escapedForms = sortedForms.map(form =>
            form.replace(/([.*+?^${}()|[\]\\])/g, '\\$&')
        );

        const pattern = escapedForms.join('|');

        const longestForm = sortedForms[0];
        const startsWithWordChar = /^[a-zA-Z0-9_]/.test(longestForm);
        const endsWithWordChar = /[a-zA-Z0-9_]$/.test(longestForm);

        const prefix = startsWithWordChar ? '\\b' : '';
        const suffix = endsWithWordChar ? '\\b' : '';

        return `${prefix}(?:${pattern})${suffix}`;
    }

    /**
     * 生成一个随机的6位数字字符串
     */
    function generateRandomPlaceholder() {
        const chars = '0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * 在DOM节点内查找一个由多部分文本组成的、有序的邻近序列
     */
    function findOrderedDOMSequence(rootNode, rule) {
        const { parts: partsWithForms, isGeneral } = rule;

        const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
                if (node.parentElement.closest('[data-glossary-applied="true"]')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        const textNodes = [];
        let node;
        while ((node = walker.nextNode())) {
            textNodes.push(node);
        }

        if (textNodes.length === 0) return null;

        for (let i = 0; i < textNodes.length; i++) {
            for (let j = 0; j < textNodes[i].nodeValue.length; j++) {
                const matchResult = findSequenceFromPosition(i, j);
                if (matchResult) {
                    return matchResult;
                }
            }
        }

        return null;

        function findSequenceFromPosition(startNodeIndex, startOffset) {
            let currentNodeIndex = startNodeIndex;
            let currentOffset = startOffset;
            const matchedWords = [];
            const endPoints = [];

            for (let partIndex = 0; partIndex < partsWithForms.length; partIndex++) {
                const currentPartForms = partsWithForms[partIndex].sort((a, b) => b.length - a.length);
                let bestMatch = null;

                let searchStr = textNodes[currentNodeIndex].nodeValue.substring(currentOffset);
                let lookaheadIndex = currentNodeIndex + 1;
                while (lookaheadIndex < textNodes.length && searchStr.length < 200) {
                    searchStr += textNodes[lookaheadIndex].nodeValue;
                    lookaheadIndex++;
                }

                const textToSearch = isGeneral ? searchStr.toLowerCase() : searchStr;

                for (const form of currentPartForms) {
                    const formToMatch = isGeneral ? form.toLowerCase() : form;
                    if (textToSearch.startsWith(formToMatch)) {
                        const prevChar = (startNodeIndex === 0 && startOffset === 0) ? ' ' : textNodes[startNodeIndex].nodeValue[startOffset - 1] || ' ';
                        if (partIndex === 0 && /[a-zA-Z0-9]/.test(prevChar)) {
                            continue;
                        }
                        bestMatch = form;
                        break;
                    }
                }

                if (bestMatch) {
                    matchedWords.push(bestMatch);
                    let consumedLength = bestMatch.length;
                    currentOffset += consumedLength;

                    while (currentOffset >= textNodes[currentNodeIndex].nodeValue.length && currentNodeIndex < textNodes.length - 1) {
                        currentOffset -= textNodes[currentNodeIndex].nodeValue.length;
                        currentNodeIndex++;
                    }
                    endPoints.push({ nodeIndex: currentNodeIndex, offset: currentOffset });

                    if (partIndex < partsWithForms.length - 1) {
                        let separatorFound = false;

                        while (currentNodeIndex < textNodes.length) {
                            const remainingInNode = textNodes[currentNodeIndex].nodeValue.substring(currentOffset);
                            const separatorMatch = remainingInNode.match(/^[\s-－﹣—–]+/);

                            if (separatorMatch) {
                                currentOffset += separatorMatch[0].length;
                                separatorFound = true;
                                break;
                            }

                            if (remainingInNode.trim() !== '') {
                                return null;
                            }

                            currentNodeIndex++;
                            currentOffset = 0;
                            if (currentNodeIndex < textNodes.length) {
                                separatorFound = true;
                            } else {
                                return null;
                            }
                        }
                        if (!separatorFound) return null;
                    }
                } else {
                    return null;
                }
            }

            const finalEndPoint = endPoints[endPoints.length - 1];
            const nextChar = textNodes[finalEndPoint.nodeIndex].nodeValue[finalEndPoint.offset] || ' ';
            if (/[a-zA-Z0-9]/.test(nextChar)) {
                return null;
            }

            return {
                startNode: textNodes[startNodeIndex],
                startOffset: startOffset,
                endNode: textNodes[finalEndPoint.nodeIndex],
                endOffset: finalEndPoint.offset,
                matchedWords: matchedWords
            };
        }
    }

    /**
     * 在DOM节点内查找一个由多部分文本组成的、无序但邻近的序列
     */
    function findUnorderedDOMSequence(rootNode, rule) {
        const { parts: partsWithForms, isGeneral } = rule;
        const HTML_TAG_PLACEHOLDER = '\u0001';
        const ALLOWED_SEPARATORS_REGEX = /^[\s\u0001-－﹣—–]*$/;
        const WORD_CHAR_REGEX = /[a-zA-Z0-9]/;
        const MAX_DISTANCE_FACTOR = 2.5;
        const MAX_DISTANCE_BASE = 30;

        const textMap = [];
        let normalizedText = '';

        const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
            acceptNode: (node) => {
                if (node.parentElement.closest('[data-glossary-applied="true"]')) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        let node;
        while ((node = walker.nextNode())) {
            if (node.nodeType === Node.TEXT_NODE) {
                const nodeValue = node.nodeValue;
                for (let i = 0; i < nodeValue.length; i++) {
                    textMap.push({ node: node, offset: i });
                }
                normalizedText += nodeValue;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (['EM', 'STRONG', 'B', 'I', 'U', 'SPAN', 'CODE'].includes(node.tagName)) {
                    textMap.push({ node: node, offset: -1 });
                    normalizedText += HTML_TAG_PLACEHOLDER;
                }
            }
        }

        if (!normalizedText.trim()) return null;

        const searchText = isGeneral ? normalizedText.toLowerCase() : normalizedText;
        const originalTermLength = partsWithForms.map(p => p[0]).join(' ').length;
        const maxDistance = Math.max(originalTermLength * MAX_DISTANCE_FACTOR, MAX_DISTANCE_BASE);

        const partPositions = partsWithForms.map(partSet => {
            const positions = [];
            for (const form of partSet) {
                const term = isGeneral ? form.toLowerCase() : form;
                let lastIndex = -1;
                while ((lastIndex = searchText.indexOf(term, lastIndex + 1)) !== -1) {
                    positions.push({ start: lastIndex, end: lastIndex + term.length });
                }
            }
            return positions;
        });

        if (partPositions.some(p => p.length === 0)) {
            return null;
        }

        function getCombinations(arr) {
            if (arr.length === 1) {
                return arr[0].map(item => [item]);
            }
            const result = [];
            const allCasesOfRest = getCombinations(arr.slice(1));
            for (let i = 0; i < allCasesOfRest.length; i++) {
                for (let j = 0; j < arr[0].length; j++) {
                    result.push([arr[0][j]].concat(allCasesOfRest[i]));
                }
            }
            return result;
        }

        const allCombinations = getCombinations(partPositions);

        for (const combination of allCombinations) {
            combination.sort((a, b) => a.start - b.start);

            const overallStart = combination[0].start;
            const overallEnd = combination[combination.length - 1].end;

            if (overallEnd - overallStart > maxDistance) {
                continue;
            }

            let isValid = true;
            for (let i = 0; i < combination.length - 1; i++) {
                const betweenText = normalizedText.substring(combination[i].end, combination[i + 1].start);
                if (!ALLOWED_SEPARATORS_REGEX.test(betweenText)) {
                    isValid = false;
                    break;
                }
            }

            if (isValid) {
                const prevChar = normalizedText[overallStart - 1];
                const nextChar = normalizedText[overallEnd];
                const startBoundaryOK = !prevChar || !WORD_CHAR_REGEX.test(prevChar);
                const endBoundaryOK = !nextChar || !WORD_CHAR_REGEX.test(nextChar);

                if (startBoundaryOK && endBoundaryOK) {
                    const startMapping = textMap[overallStart];
                    const endMapping = textMap[overallEnd - 1];
                    if (startMapping && endMapping) {
                        return {
                            startNode: startMapping.node,
                            startOffset: startMapping.offset,
                            endNode: endMapping.node,
                            endOffset: endMapping.offset + 1
                        };
                    }
                }
            }
        }

        return null;
    }

    /**
     * 预处理单个段落DOM节点，应用所有术语表规则并替换为占位符
     */
    function _preprocessParagraph(p, rules, placeholders, placeholderCache, engineName) {
        const clone = p.cloneNode(true);

        const domRules = rules.filter(r => r.matchStrategy === 'dom');
        if (domRules.length > 0) {
            let domReplaced;
            do {
                domReplaced = false;
                for (const rule of domRules) {
                    let match;
                    if (rule.isUnordered) {
                        match = findUnorderedDOMSequence(clone, rule);
                    } else {
                        match = findOrderedDOMSequence(clone, rule);
                    }

                    if (match) {
                        const range = document.createRange();
                        range.setStart(match.startNode, match.startOffset);
                        range.setEnd(match.endNode, match.endOffset);

                        const contents = range.extractContents();
                        const tempDiv = document.createElement('div');
                        tempDiv.appendChild(contents);
                        const originalHTML = tempDiv.innerHTML;

                        const finalValue = rule.type === 'forbidden' ? originalHTML : rule.replacement;
                        let placeholder;

                        if (placeholderCache.has(finalValue)) {
                            placeholder = placeholderCache.get(finalValue);
                        } else {
                            placeholder = `ph_${generateRandomPlaceholder()}`;
                            placeholderCache.set(finalValue, placeholder);
                            placeholders.set(placeholder, { value: finalValue, rule: rule, originalHTML: originalHTML });
                        }

                        const placeholderNode = document.createTextNode(placeholder);
                        range.insertNode(placeholderNode);

                        clone.normalize();
                        domReplaced = true;
                        break;
                    }
                }
            } while (domReplaced);
        }

        const regexRules = rules.filter(r => r.matchStrategy === 'regex');
        if (regexRules.length > 0) {
            const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT, {
                acceptNode: (node) => {
                    if (node.parentElement.closest('[data-glossary-applied="true"]')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            });
            const textNodes = [];
            let n;
            while (n = walker.nextNode()) textNodes.push(n);

            const combinedRegex = new RegExp(regexRules.map(r => `(${r.regex.source})`).join('|'), 'g');

            textNodes.forEach(node => {
                if (!node.parentNode) return;

                const text = node.nodeValue;
                const matches = Array.from(text.matchAll(combinedRegex));

                if (matches.length > 0) {
                    const fragment = document.createDocumentFragment();
                    let lastIndex = 0;

                    matches.forEach(match => {
                        const matchedText = match[0];
                        const matchIndex = match.index;

                        if (matchIndex > lastIndex) {
                            fragment.appendChild(document.createTextNode(text.substring(lastIndex, matchIndex)));
                        }

                        const ruleIndex = match.slice(1).findIndex(g => g !== undefined);
                        const rule = regexRules[ruleIndex];

                        const placeholderNode = _applyRuleToTextMatch(matchedText, rule, placeholders, placeholderCache, engineName);
                        fragment.appendChild(placeholderNode);

                        lastIndex = matchIndex + matchedText.length;
                    });

                    if (lastIndex < text.length) {
                        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
                    }

                    node.parentNode.replaceChild(fragment, node);
                }
            });
        }
        return clone;
    }

    /**
     * 将规则应用于通过正则表达式找到的文本匹配，并返回占位符节点
     */
    function _applyRuleToTextMatch(match, rule, placeholders, placeholderCache, engineName) {
        const finalValue = rule.type === 'forbidden' ? match : rule.replacement;
        let placeholder;
        if (placeholderCache.has(finalValue)) {
            placeholder = placeholderCache.get(finalValue);
        } else {
            placeholder = `ph_${generateRandomPlaceholder()}`;
            placeholderCache.set(finalValue, placeholder);
            placeholders.set(placeholder, { value: finalValue, rule: rule, originalHTML: match });
        }

        return document.createTextNode(placeholder);
    }

    /**
     * 替换一个 DOM 节点并完整保留所有 HTML 标签结构
     */
    function replaceTextInNode(node, newText) {
        if (node.nodeType === Node.TEXT_NODE) {
            node.nodeValue = newText;
            return;
        }

        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        let currentNode;
        while ((currentNode = walker.nextNode())) {
            textNodes.push(currentNode);
        }

        if (textNodes.length > 0) {
            textNodes[0].nodeValue = newText;
            for (let i = 1; i < textNodes.length; i++) {
                textNodes[i].nodeValue = '';
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            node.textContent = newText;
        }
    }

    /**
     * 后处理翻译后的文本，将占位符还原为最终的HTML或文本
     */
    function _postprocessAndRestoreText(translatedText, placeholders, engineName) {
        let processedText = translatedText;

        try {
            const junkChars = '[\\s\\u200B-\\u200D\\uFEFF]*';
            const underscore = '[_＿]';
            const digit = `(\\d)${junkChars}`;
            const advancedPurgeRegex = new RegExp(`p${junkChars}h${junkChars}${underscore}${junkChars}${digit}${digit}${digit}${digit}${digit}(\\d)`, 'g');

            if (advancedPurgeRegex.test(processedText)) {
                processedText = processedText.replace(advancedPurgeRegex, (_match, d1, d2, d3, d4, d5, d6) => {
                    return `ph_${d1}${d2}${d3}${d4}${d5}${d6}`;
                });
            }
        } catch (e) {
            console.warn('Error during placeholder advanced purge:', e);
        }

        if (placeholders.size === 0) {
            return applyPostTranslationReplacements(processedText);
        }

        for (const [placeholder, data] of placeholders.entries()) {
            const { value: replacement, originalHTML, rule } = data;
            const escapedPlaceholder = placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(escapedPlaceholder, 'g');

            if (DEBUG_MODE) {
                console.group(`[术语表回填] 处理占位符: ${placeholder}`);
                console.log(`  - 规则类型: ${rule.matchStrategy}`);
                console.log(`  - 原始术语: "${rule.originalTerm}"`);
                console.log(`  - 原始HTML/文本:`, originalHTML);
                console.log(`  - 目标译文/内容:`, replacement);
            }

            if (rule.matchStrategy === 'dom' && originalHTML) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = originalHTML;

                const htmlChunks = Array.from(tempDiv.childNodes).filter(node =>
                    !(node.nodeType === Node.TEXT_NODE && !node.nodeValue.trim())
                );

                const separator = replacement.includes('·') || replacement.includes('・') ? /[·・]/ : /[\s-－﹣—–]+/;
                const joinSeparator = replacement.includes('·') || replacement.includes('・') ? '·' : ' ';
                const translationParts = replacement.split(separator);

                if (DEBUG_MODE) {
                    console.log(`  - 原始HTML被分解为 ${htmlChunks.length} 个结构块:`, htmlChunks.map(c => c.cloneNode(true)));
                    console.log(`  - 译文被分解为 ${translationParts.length} 个部分 (使用分隔符 "${separator}"):`, translationParts);
                }

                if (htmlChunks.length === translationParts.length) {
                    if (DEBUG_MODE) console.log(`  - 验证通过：结构块数量与译文部分数量匹配。开始注入...`);
                    htmlChunks.forEach((chunk, index) => {
                        const part = translationParts[index];
                        if (DEBUG_MODE) console.log(`    - 注入部分 #${index + 1}: 将 "${part}" 注入到`, chunk.cloneNode(true));
                        replaceTextInNode(chunk, part);
                    });

                    const finalHTML = htmlChunks.map(chunk => {
                        return chunk.nodeType === Node.ELEMENT_NODE ? chunk.outerHTML : chunk.nodeValue;
                    }).join(joinSeparator);

                    if (DEBUG_MODE) console.log(`  - 重组后的最终HTML:`, finalHTML);
                    processedText = processedText.replace(regex, finalHTML);
                } else {
                    if (DEBUG_MODE) {
                        console.warn(`  - [回退] HTML结构块数量 (${htmlChunks.length}) 与译文部分数量 (${translationParts.length}) 不匹配！`);
                        console.warn(`  - 执行安全回退：将完整译文注入，可能会丢失内部格式。`);
                    }
                    tempDiv.innerHTML = originalHTML;
                    tempDiv.textContent = replacement;
                    const fallbackHTML = tempDiv.innerHTML;
                    if (DEBUG_MODE) console.log(`  - 回退生成的HTML:`, fallbackHTML);
                    processedText = processedText.replace(regex, fallbackHTML);
                }
            } else {
                if (DEBUG_MODE) console.log(`  - (Regex策略) 直接替换为目标内容。`);
                processedText = processedText.replace(regex, replacement);
            }
            if (DEBUG_MODE) console.groupEnd();
        }

        return applyPostTranslationReplacements(processedText);
    }

    /**
     * 段落翻译函数，集成了术语表、禁翻和后处理替换逻辑
     */
    async function translateParagraphs(paragraphs, { maxRetries = 3 } = {}) {
        if (!paragraphs || paragraphs.length === 0) {
            return new Map();
        }

        const indexedParagraphs = paragraphs.map((p, index) => ({
            original: p,
            index: index,
            isSeparator: p.tagName === 'HR' || /^\s*[-—*~<>=.]{3,}\s*$/.test(p.textContent),
            content: p.innerHTML
        }));

        const contentToTranslate = indexedParagraphs.filter(p => !p.isSeparator);
        if (contentToTranslate.length === 0) {
            const results = new Map();
            indexedParagraphs.forEach(p => {
                results.set(p.original, { status: 'success', content: p.content });
            });
            return results;
        }

        let lastTranslationAttempt = '';
        let lastPlaceholdersMap = new Map();
        const engineName = getValidEngineName();

        for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
            try {
                const rules = getGlossaryRules();
                const placeholders = new Map();
                const placeholderCache = new Map();

                const preprocessedParagraphs = [];
                const CHUNK_PROCESSING_SIZE = 5;
                for (let i = 0; i < contentToTranslate.length; i++) {
                    const p = contentToTranslate[i];
                    preprocessedParagraphs.push(_preprocessParagraph(p.original, rules, placeholders, placeholderCache, engineName));
                    if ((i + 1) % CHUNK_PROCESSING_SIZE === 0) {
                        await sleep(0);
                    }
                }

                const preprocessedText = preprocessedParagraphs.map(p => p.innerHTML).join(' ');
                const expectedCounts = {};
                const legalPlaceholders = new Set();
                for (const key of placeholders.keys()) {
                    expectedCounts[key] = (preprocessedText.match(new RegExp(key, 'g')) || []).length;
                    legalPlaceholders.add(key);
                }

                const combinedTranslation = await requestRemoteTranslation(preprocessedParagraphs);

                lastTranslationAttempt = combinedTranslation;
                lastPlaceholdersMap = placeholders;

                const placeholderScanRegex = /(ph_\d{6})/g;

                const suspectedPlaceholders = Array.from(combinedTranslation.matchAll(placeholderScanRegex)).map(match => match[1]);
                const actualCounts = {};
                legalPlaceholders.forEach(key => actualCounts[key] = 0);

                let shouldRetryForUnknown = false;

                for (const suspected of suspectedPlaceholders) {
                    let isKnown = false;
                    for (const legal of legalPlaceholders) {
                        if (suspected.startsWith(legal)) {
                            actualCounts[legal]++;
                            isKnown = true;
                            break;
                        }
                    }
                    if (!isKnown) {
                        shouldRetryForUnknown = true;
                    }
                }

                const thresholds = CONFIG.VALIDATION_THRESHOLDS;
                const absoluteLossThreshold = thresholds.absolute_loss[engineName] || thresholds.absolute_loss.default;
                const proportionalLossThreshold = thresholds.proportional_loss;
                const proportionalTriggerCount = thresholds.proportional_trigger_count;

                let shouldRetryForMissing = false;
                for (const key of legalPlaceholders) {
                    const expected = expectedCounts[key];
                    const actual = actualCounts[key];
                    const loss = expected - actual;

                    if (loss > 0) {
                        const isCatastrophicLoss = expected > 2 && actual === 0;
                        const isAbsoluteLoss = loss >= absoluteLossThreshold;
                        const isProportionalLoss = expected >= proportionalTriggerCount && (loss / expected) >= proportionalLossThreshold;

                        if (isCatastrophicLoss || isAbsoluteLoss || isProportionalLoss) {
                            shouldRetryForMissing = true;
                            break;
                        }
                    }
                }

                if (shouldRetryForMissing || shouldRetryForUnknown) {
                    const errorReason = shouldRetryForUnknown ? "检测到未知占位符" : "占位符大量缺失";
                    throw new Error(`占位符校验失败 (${errorReason})！`);
                }

                const restoredTranslation = _postprocessAndRestoreText(combinedTranslation, placeholders, engineName);

                let translatedParts = [];
                if (contentToTranslate.length === 1 && !restoredTranslation.trim().startsWith('1.')) {
                    translatedParts.push(restoredTranslation.trim());
                } else {
                    const regex = /\d+\.\s*([\s\S]*?)(?=\n\d+\.|$)/g;
                    let match;
                    while ((match = regex.exec(restoredTranslation)) !== null) {
                        translatedParts.push(match[1].trim());
                    }

                    if (translatedParts.length !== contentToTranslate.length && restoredTranslation.includes('\n')) {
                        const potentialParts = restoredTranslation.split('\n').filter(p => p.trim().length > 0);
                        if (potentialParts.length === contentToTranslate.length) {
                            translatedParts = potentialParts.map(p => p.replace(/^\d+\.\s*/, '').trim());
                        }
                    }
                }

                if (translatedParts.length !== contentToTranslate.length) {
                    throw new Error('AI 响应格式不一致，分段数量不匹配');
                }

                const finalResults = new Map();
                indexedParagraphs.forEach(p => {
                    if (p.isSeparator) {
                        finalResults.set(p.original, { status: 'success', content: p.content });
                    } else {
                        const originalPara = contentToTranslate.find(item => item.index === p.index);
                        if (originalPara) {
                            const transIndex = contentToTranslate.indexOf(originalPara);
                            const cleanedContent = AdvancedTranslationCleaner.clean(translatedParts[transIndex] || p.content);
                            finalResults.set(p.original, { status: 'success', content: cleanedContent });
                        }
                    }
                });
                return finalResults;

            } catch (e) {
                if (DEBUG_MODE) {
                    console.error(`翻译尝试 #${retryCount + 1} 失败:`, e);
                }
                if (retryCount < maxRetries) {
                    await sleep(500 * (retryCount + 1));
                    continue;
                } else {
                    if (e.message.includes('分段数量不匹配') && paragraphs.length > 1) {
                        if (DEBUG_MODE) {
                            console.warn('批量翻译失败，正在尝试逐段回退翻译...');
                        }
                        const fallbackResults = new Map();
                        for (const p of paragraphs) {
                            const singleResultMap = await translateParagraphs([p], { maxRetries: 0 });
                            const singleResult = singleResultMap.get(p);
                            fallbackResults.set(p, singleResult || { status: 'error', content: '逐段翻译失败' });
                        }
                        return fallbackResults;
                    }

                    const restoredTranslation = _postprocessAndRestoreText(lastTranslationAttempt, lastPlaceholdersMap, engineName);
                    let translatedParts = [];
                    const regex = /\d+\.\s*([\s\S]*?)(?=\n\d+\.|$)/g;
                    let match;
                    while ((match = regex.exec(restoredTranslation)) !== null) {
                        translatedParts.push(match[1].trim());
                    }
                    const finalResults = new Map();
                    indexedParagraphs.forEach(p => {
                        if (p.isSeparator) {
                            finalResults.set(p.original, { status: 'success', content: p.content });
                        } else {
                            const originalPara = contentToTranslate.find(item => item.index === p.index);
                            if (originalPara) {
                                const transIndex = contentToTranslate.indexOf(originalPara);
                                const content = translatedParts[transIndex] || `翻译失败：${e.message}`;
                                const cleanedContent = AdvancedTranslationCleaner.clean(content);
                                finalResults.set(p.original, { status: 'success', content: cleanedContent });
                            }
                        }
                    });
                    if (DEBUG_MODE) {
                        console.error('所有重试均失败，返回部分或错误结果。');
                    }
                    return finalResults;
                }
            }
        }
    }

    /**
     * 创建并返回一个独立的翻译任务控制实例
     */
    function createTranslationController(options) {
        const { containerElement, buttonWrapper, originalButtonText, isLazyLoad } = options;

        const controller = {
            state: 'idle',
            observer: null,
            isCancellationRequested: false,

            updateButtonState: function(text, stateClass = '') {
                if (buttonWrapper) {
                    const button = buttonWrapper.querySelector('div');
                    if (button) {
                        button.textContent = text;
                    }
                    buttonWrapper.className = `translate-me-ao3-wrapper ${stateClass}`;
                }
            },

            start: function() {
                if (this.state === 'running') return;

                this.state = 'running';
                this.isCancellationRequested = false;
                this.updateButtonState('翻译中…', 'state-running');

                const onComplete = () => {
                    if (!this.isCancellationRequested) {
                        this.state = 'complete';
                        this.updateButtonState('清除译文', 'state-complete');
                    }
                };

                if (isLazyLoad) {
                    this.observer = runTranslationEngineWithObserver({
                        containerElement: containerElement,
                        isCancelled: () => this.isCancellationRequested,
                        onProgress: () => {},
                        onComplete: onComplete
                    });
                } else {
                    runTranslationEngineForBlock(containerElement, () => this.isCancellationRequested, onComplete);
                }
            },

            stop: function() {
                if (this.state !== 'running') return;

                this.state = 'paused';
                this.isCancellationRequested = true;
                if (this.observer) {
                    this.observer.disconnect();
                    this.observer = null;
                }
                this.updateButtonState(originalButtonText, 'state-idle');
            },

            clear: function() {
                this.stop();

                const translationNodes = containerElement.querySelectorAll('.translated-by-ao3-script, .translated-by-ao3-script-error');
                translationNodes.forEach(node => node.remove());

                containerElement.querySelectorAll('[data-translation-state="translated"]').forEach(originalUnit => {
                    originalUnit.style.display = '';
                    delete originalUnit.dataset.translationState;
                });

                this.state = 'idle';
                this.updateButtonState(originalButtonText, 'state-idle');
            },

            handleClick: function() {
                switch (this.state) {
                    case 'idle':
                    case 'paused':
                        this.start();
                        break;
                    case 'running':
                        this.stop();
                        break;
                    case 'complete':
                        this.clear();
                        break;
                }
            }
        };

        return controller;
    }

    /**
     * 翻译引擎（用于简介、注释、评论等区域）
     */
    async function runTranslationEngineForBlock(containerElement, isCancelled, onComplete) {
        const translatableSelectors = 'p, blockquote, li, h1, h2, h3:not(.landmark), h4, h5, h6';
        let allPotentialUnits = Array.from(containerElement.querySelectorAll(translatableSelectors));

        if (allPotentialUnits.length === 0 && containerElement.textContent.trim()) {
            allPotentialUnits = [containerElement];
        }

        const skippableHeaders = ['Summary', 'Notes', 'Work Text'];
        const units = allPotentialUnits.filter(p =>
            !skippableHeaders.includes(p.textContent.trim()) &&
            !p.querySelector(translatableSelectors)
        );

        if (units.length === 0) {
            if (onComplete) onComplete();
            return;
        }

        units.forEach(unit => unit.dataset.translationState = 'translating');

        const translationResults = await translateParagraphs(units);

        if (isCancelled()) {
            units.forEach(unit => delete unit.dataset.translationState);
            return;
        }

        const currentMode = GM_getValue('translation_display_mode', 'bilingual');

        units.forEach(unit => {
            const result = translationResults.get(unit);
            if (result) {
                const transNode = document.createElement('div');
                const newTranslatedElement = unit.cloneNode(false);
                newTranslatedElement.innerHTML = result.content;

                if (result.status === 'success') {
                    transNode.className = 'translated-by-ao3-script';
                    unit.dataset.translationState = 'translated';
                    if (currentMode === 'translation_only') {
                        unit.style.display = 'none';
                    }
                } else {
                    transNode.className = 'translated-by-ao3-script-error';
                    unit.dataset.translationState = 'error';
                }
                transNode.appendChild(newTranslatedElement);
                transNode.style.cssText = 'margin-top: 0.25em; margin-bottom: 1em;';
                unit.after(transNode);
            } else {
                unit.dataset.translationState = 'error';
            }
        });

        if (onComplete) onComplete();
    }

    /**
     * 翻译引擎（懒加载模式）
     */
    function runTranslationEngineWithObserver(options) {
        const { containerElement, isCancelled, onProgress, onComplete } = options;
        const elementState = new WeakMap();
        let isProcessing = false;
        const translationQueue = new Set();
        let scheduleTimeout = null;
        let flushTimeout = null;

        function preProcessAndGetUnits(container) {
            const elementsToProcess = container.querySelectorAll('p, blockquote');
            const elementsToModify = [];
            elementsToProcess.forEach(el => {
                if (elementState.has(el)) return;
                const hasBrSeparators = (el.innerHTML.match(/(?:<br\s*\/?>\s*)+/i));
                if (hasBrSeparators) {
                    elementsToModify.push(el);
                }
                elementState.set(el, { preprocessed: true });
            });

            elementsToModify.forEach(el => {
                const separatorRegex = /(?:\s*<br\s*\/?>\s*)+/ig;
                const fragmentsHTML = el.innerHTML.split(separatorRegex);
                const newElements = fragmentsHTML.map(fragment => fragment.trim()).filter(fragment => fragment).map(fragment => {
                    const newP = document.createElement(el.tagName);
                    newP.innerHTML = fragment;
                    elementState.set(newP, { preprocessed: true });
                    return newP;
                });
                if (newElements.length > 1) {
                    el.after(...newElements);
                    el.remove();
                }
            });

            const translatableSelectors = 'p, blockquote, li, h1, h2, h3, h4, h5, h6, hr';
            const allPotentialUnits = Array.from(container.querySelectorAll(translatableSelectors));
            const skippableHeaders = ['Summary', 'Notes', 'Work Text', 'Chapter Text'];
            const candidateUnits = allPotentialUnits.filter(p => !skippableHeaders.includes(p.textContent.trim()));
            const finalUnits = [];
            for (const unit of candidateUnits) {
                if (!unit.querySelector(translatableSelectors)) {
                    finalUnits.push(unit);
                }
            }
            return finalUnits;
        }

        const allUnits = preProcessAndGetUnits(containerElement);
        const unitsToObserve = allUnits.filter(unit => !unit.dataset.translationState);
        const totalUnits = unitsToObserve.length;
        let translatedUnits = 0;

        if (totalUnits === 0) {
            if (onComplete) onComplete();
            return null;
        }

        const isInViewport = (el) => {
            const rect = el.getBoundingClientRect();
            return (rect.top < window.innerHeight && rect.bottom >= 0);
        };

        const processQueue = async (forceFlush = false) => {
            if (isCancelled() || isProcessing || translationQueue.size === 0) return;

            clearTimeout(flushTimeout);

            const allQueuedUnits = [...translationQueue];
            if (allQueuedUnits.length === 0) return;

            const visibleInQueue = allQueuedUnits.filter(isInViewport);
            const offscreenInQueue = allQueuedUnits.filter(p => !visibleInQueue.includes(p));
            const prioritizedUnits = [...visibleInQueue, ...offscreenInQueue];

            const runType = isFirstTranslationChunk ? 'first' : 'subsequent';
            const engineName = getValidEngineName();
            const modelId = getCurrentModelId(engineName);
            let paragraphLimit = CONFIG[runType === 'first' ? 'PARAGRAPH_LIMIT' : 'SUBSEQUENT_PARAGRAPH_LIMIT'];
            let chunkSize = CONFIG[runType === 'first' ? 'CHUNK_SIZE' : 'SUBSEQUENT_CHUNK_SIZE'];
            const priorityKeys = [modelId, engineName].filter(Boolean);
            for (const key of priorityKeys) {
                const specificLimits = getNestedProperty(CONFIG.MODEL_SPECIFIC_LIMITS, `${key}.${runType}`);
                if (specificLimits) {
                    paragraphLimit = specificLimits.PARAGRAPH_LIMIT || paragraphLimit;
                    chunkSize = specificLimits.CHUNK_SIZE || chunkSize;
                    break;
                }
            }

            let currentChars = 0;
            let chunkToSend = [];
            for (const unit of prioritizedUnits) {
                const isSeparator = unit.tagName === 'HR' || /^\s*[-—*~<>=.]{3,}\s*$/.test(unit.textContent);
                if (isSeparator) {
                    if (chunkToSend.length > 0) break;
                    chunkToSend.push(unit);
                    break;
                }
                chunkToSend.push(unit);
                currentChars += unit.textContent.length;
                if (chunkToSend.length >= paragraphLimit || currentChars >= chunkSize) break;
            }

            const isChunkBigEnough = chunkToSend.length >= paragraphLimit || currentChars >= chunkSize;
            const isChunkSeparator = chunkToSend.length > 0 && (chunkToSend[0].tagName === 'HR' || /^\s*[-—*~<>=.]{3,}\s*$/.test(chunkToSend[0].textContent));

            if (!isChunkBigEnough && !isChunkSeparator && !forceFlush) {
                if (translationQueue.size > 0) {
                    flushTimeout = setTimeout(() => scheduleProcessing(true), 4000);
                }
                return;
            }
            if (chunkToSend.length === 0) return;

            isProcessing = true;
            if (isFirstTranslationChunk) isFirstTranslationChunk = false;
            chunkToSend.forEach(p => {
                translationQueue.delete(p);
                p.dataset.translationState = 'translating';
            });

            try {
                const paragraphsToTranslate = chunkToSend.filter(p => p.tagName !== 'HR' && p.textContent.trim().length > 0);
                const translationResults = paragraphsToTranslate.length > 0 ? await translateParagraphs(paragraphsToTranslate) : new Map();

                if (isCancelled()) return;

                for (const p of chunkToSend) {
                    observer.unobserve(p);
                    translatedUnits++;

                    if (p.tagName === 'HR' || p.textContent.trim().length === 0 || /^\s*[-—*~<>=.]{3,}\s*$/.test(p.textContent)) {
                        p.dataset.translationState = 'translated';
                        continue;
                    }
                    const result = translationResults.get(p);
                    if (result) {
                        const transNode = document.createElement('div');
                        const newTranslatedElement = p.cloneNode(false);
                        newTranslatedElement.innerHTML = result.content;

                        if (result.status === 'success') {
                            transNode.className = 'translated-by-ao3-script';
                            const currentMode = GM_getValue('translation_display_mode', 'bilingual');
                            if (currentMode === 'translation_only') p.style.display = 'none';
                            p.dataset.translationState = 'translated';
                        } else {
                            transNode.className = 'translated-by-ao3-script-error';
                            newTranslatedElement.innerHTML = `翻译失败：${result.content.replace('翻译失败：', '')}`;
                            p.dataset.translationState = 'error';
                        }
                        transNode.appendChild(newTranslatedElement);
                        transNode.style.cssText = 'margin-top: 0.25em; margin-bottom: 1em;';
                        p.after(transNode);
                    } else {
                        p.dataset.translationState = 'error';
                    }
                }
            } finally {
                isProcessing = false;
                if (onProgress) onProgress(translatedUnits, totalUnits);

                if (translatedUnits >= totalUnits) {
                    if (onComplete) onComplete();
                    if (observer) observer.disconnect();
                } else if (translationQueue.size > 0 && !isCancelled()) {
                    scheduleProcessing(false);
                }
            }
        };

        const scheduleProcessing = (force = false) => {
            if (isCancelled()) return;
            clearTimeout(scheduleTimeout);
            scheduleTimeout = setTimeout(() => processQueue(force), 300);
        };

        let effectiveRootMargin = CONFIG.LAZY_LOAD_ROOT_MARGIN;
        const engineName = getValidEngineName();
        const modelId = getCurrentModelId(engineName);
        const priorityKeys = [modelId, engineName].filter(Boolean);
        for (const key of priorityKeys) {
            const specificMargin = getNestedProperty(CONFIG.MODEL_SPECIFIC_LIMITS, `${key}.LAZY_LOAD_ROOT_MARGIN`);
            if (specificMargin) {
                effectiveRootMargin = specificMargin;
                break;
            }
        }

        const observer = new IntersectionObserver((entries) => {
            if (isCancelled()) return;
            let addedToQueue = false;
            entries.forEach(entry => {
                if (entry.isIntersecting && !entry.target.dataset.translationState) {
                    translationQueue.add(entry.target);
                    addedToQueue = true;
                }
            });
            if (addedToQueue) {
                scheduleProcessing(false);
            }
        }, { rootMargin: effectiveRootMargin });

        unitsToObserve.forEach(unit => {
            observer.observe(unit);
        });

        return observer;
    }

    /**
     * 各种术语表变量
     */
    const LOCAL_GLOSSARY_KEY = 'ao3_local_glossary';
    const LOCAL_GLOSSARY_STRING_KEY = 'ao3_local_glossary_string';
    const LOCAL_FORBIDDEN_TERMS_KEY = 'ao3_local_forbidden_terms';
    const LOCAL_FORBIDDEN_STRING_KEY = 'ao3_local_forbidden_string';
    const IMPORTED_GLOSSARY_KEY = 'ao3_imported_glossary';
    const GLOSSARY_METADATA_KEY = 'ao3_glossary_metadata';
    const POST_REPLACE_STRING_KEY = 'ao3_post_replace_string';
    const POST_REPLACE_MAP_KEY = 'ao3_post_replace_map';
    const LAST_SELECTED_GLOSSARY_KEY = 'ao3_last_selected_glossary_url';
    const GLOSSARY_RULES_CACHE_KEY = 'ao3_glossary_rules_cache';

    /**
     * 解析自定义的、非 JSON 格式的术语表文本
     */
    function parseCustomGlossaryFormat(text) {
        const result = {
            metadata: {},
            terms: {},
            generalTerms: {},
            multiPartTerms: {},
            multiPartGeneralTerms: {},
            forbiddenTerms: [],
            regexTerms: []
        };
        const lines = text.split('\n');

        const sectionHeaders = {
            TERMS: ['terms', '词条'],
            GENERAL_TERMS: ['general terms', '通用词条'],
            FORBIDDEN_TERMS: ['forbidden terms', '禁翻词条'],
            REGEX_TERMS: ['regex', '正则表达式']
        };

        const sections = [];
        let metadataLines = [];
        let inMetadata = true;

        for (let i = 0; i < lines.length; i++) {
            const trimmedLine = lines[i].trim().toLowerCase().replace(/[:：\s]*$/, '');
            let isHeader = false;
            for (const key in sectionHeaders) {
                if (sectionHeaders[key].includes(trimmedLine)) {
                    sections.push({ type: key, start: i + 1 });
                    isHeader = true;
                    inMetadata = false;
                    break;
                }
            }
            if (inMetadata && lines[i].trim()) {
                metadataLines.push(lines[i]);
            }
        }

        const metadataRegex = /^\s*(maintainer|version|last_updated|维护者|版本号|更新时间)\s*[:：]\s*(.*?)\s*[,，]?\s*$/;
        for (const line of metadataLines) {
            const metadataMatch = line.match(metadataRegex);
            if (metadataMatch) {
                let key = metadataMatch[1].trim();
                let value = metadataMatch[2].trim();
                const keyMap = { '维护者': 'maintainer', '版本号': 'version', '更新时间': 'last_updated' };
                result.metadata[keyMap[key] || key] = value;
            }
        }

        const processLine = (line, target, multiPartTarget) => {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('//')) return;

            const multiPartParts = trimmedLine.split(/[=＝]/, 2);
            if (multiPartParts.length === 2) {
                const key = multiPartParts[0].trim();
                const value = multiPartParts[1].trim().replace(/[,，]$/, '');
                if (key && value) multiPartTarget[key] = value;
                return;
            }

            const singleParts = trimmedLine.split(/[:：]/, 2);
            if (singleParts.length === 2) {
                const key = singleParts[0].trim();
                const value = singleParts[1].trim().replace(/[,，]$/, '');
                if (key && value) target[key] = value;
            }
        };

        for (let i = 0; i < sections.length; i++) {
            const section = sections[i];
            const end = (i + 1 < sections.length) ? sections[i + 1].start - 1 : lines.length;
            const sectionLines = lines.slice(section.start, end);

            for (const line of sectionLines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine.startsWith('//')) continue;

                switch (section.type) {
                    case 'TERMS':
                        processLine(line, result.terms, result.multiPartTerms);
                        break;
                    case 'GENERAL_TERMS':
                        processLine(line, result.generalTerms, result.multiPartGeneralTerms);
                        break;
                    case 'FORBIDDEN_TERMS':
                        const term = trimmedLine.replace(/[,，]$/, '');
                        if (term) result.forbiddenTerms.push(term);
                        break;
                    case 'REGEX_TERMS':
                        const match = trimmedLine.match(/^(.+?)\s*[:：]\s*(.*)$/s);
                        if (match) {
                            const pattern = match[1].trim();
                            const replacement = match[2].trim().replace(/[,，]$/, '');
                            if (pattern) {
                                result.regexTerms.push({ pattern, replacement });
                            }
                        }
                        break;
                }
            }
        }

        if (!result.metadata.version) {
            throw new Error('文件格式错误：必须在文件头部包含 "版本号" 或 "version" 字段。');
        }
        if (Object.keys(result.terms).length === 0 && Object.keys(result.generalTerms).length === 0 &&
            Object.keys(result.multiPartTerms).length === 0 && Object.keys(result.multiPartGeneralTerms).length === 0 &&
            result.forbiddenTerms.length === 0 && result.regexTerms.length === 0) {
            throw new Error('文件格式错误：必须包含至少一个有效词条区域 (词条, 通用词条, 禁翻词条, 正则表达式)。');
        }

        return result;
    }

    /**
     * 从 GitHub 或 jsDelivr 导入在线术语表文件
     */
    function importOnlineGlossary(url, options = {}) {
        const { silent = false } = options;

        return new Promise((resolve) => {
            if (!url || !url.trim()) {
                return resolve({ success: false, name: '未知', message: 'URL 不能为空。' });
            }

            const glossaryUrlRegex = /^(https:\/\/(raw\.githubusercontent\.com\/[^\/]+\/[^\/]+\/(?:refs\/heads\/)?[^\/]+|cdn\.jsdelivr\.net\/gh\/[^\/]+\/[^\/]+@[^\/]+)\/.+)$/;
            if (!glossaryUrlRegex.test(url)) {
                const message = "链接格式不正确。请输入一个有效的 GitHub Raw 或 jsDelivr 链接。";
                if (!silent) alert(message);
                return resolve({ success: false, name: url, message });
            }

            const filename = url.split('/').pop();
            const lastDotIndex = filename.lastIndexOf('.');
            const baseName = (lastDotIndex > 0) ? filename.substring(0, lastDotIndex) : filename;
            const glossaryName = decodeURIComponent(baseName);

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: function(response) {
                    if (response.status !== 200) {
                        const message = `下载 “${glossaryName}” 失败！服务器返回状态码: ${response.status}`;
                        if (!silent) notifyAndLog(message, '导入错误', 'error');
                        return resolve({ success: false, name: glossaryName, message });
                    }
                    try {
                        const onlineData = parseCustomGlossaryFormat(response.responseText);

                        const allImportedGlossaries = GM_getValue(IMPORTED_GLOSSARY_KEY, {});
                        allImportedGlossaries[url] = {
                            terms: onlineData.terms,
                            generalTerms: onlineData.generalTerms,
                            multiPartTerms: onlineData.multiPartTerms,
                            multiPartGeneralTerms: onlineData.multiPartGeneralTerms,
                            forbiddenTerms: onlineData.forbiddenTerms,
                            regexTerms: onlineData.regexTerms
                        };
                        GM_setValue(IMPORTED_GLOSSARY_KEY, allImportedGlossaries);

                        const metadata = GM_getValue(GLOSSARY_METADATA_KEY, {});
                        const existingMetadata = metadata[url] || {};
                        metadata[url] = { ...existingMetadata, ...onlineData.metadata, last_imported: getShanghaiTimeString() };
                        if (typeof metadata[url].enabled !== 'boolean') {
                            metadata[url].enabled = true;
                        }
                        GM_setValue(GLOSSARY_METADATA_KEY, metadata);
                        invalidateGlossaryCache();

                        const importedCount = Object.keys(onlineData.terms).length + Object.keys(onlineData.generalTerms).length +
                                              Object.keys(onlineData.multiPartTerms).length + Object.keys(onlineData.multiPartGeneralTerms).length +
                                              onlineData.regexTerms.length;
                        const message = `已成功导入 “${glossaryName}” 术语表（v${onlineData.metadata.version}），共 ${importedCount} 个词条。`;
                        if (!silent) notifyAndLog(message, '导入成功');

                        resolve({ success: true, name: glossaryName, message });

                    } catch (e) {
                        const message = `导入 “${glossaryName}” 失败：${e.message}`;
                        if (!silent) notifyAndLog(message, '处理错误', 'error');
                        resolve({ success: false, name: glossaryName, message });
                    }
                },
                onerror: function() {
                    const message = `下载 “${glossaryName}” 失败！请检查网络连接或链接。`;
                    if (!silent) notifyAndLog(message, '网络错误', 'error');
                    resolve({ success: false, name: glossaryName, message });
                }
            });
        });
    }

    /**
     * 比较版本号的函数
     */
    function compareVersions(v1, v2) {
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        const len = Math.max(parts1.length, parts2.length);

        for (let i = 0; i < len; i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;
            if (p1 > p2) return 1;
            if (p1 < p2) return -1;
        }
        return 0;
    }

    /**
     * 检查并更新所有已导入的在线术语表
     */
    async function checkForGlossaryUpdates() {
        const metadata = GM_getValue(GLOSSARY_METADATA_KEY, {});
        const urls = Object.keys(metadata);

        if (urls.length === 0) {
            return;
        }

        for (const url of urls) {
            try {
                const response = await new Promise((resolve, reject) => {
                    const urlWithCacheBust = url + '?t=' + new Date().getTime();
                    GM_xmlhttpRequest({ method: 'GET', url: urlWithCacheBust, onload: resolve, onerror: reject, ontimeout: reject });
                });

                if (response.status !== 200) {
                    throw new Error(`服务器返回状态码: ${response.status}`);
                }

                const onlineData = parseCustomGlossaryFormat(response.responseText);
                const currentMetadata = GM_getValue(GLOSSARY_METADATA_KEY, {});
                const localVersion = currentMetadata[url]?.version;
                const onlineVersion = onlineData.metadata.version;

                if (!localVersion || compareVersions(onlineVersion, localVersion) > 0) {
                    const glossaryName = decodeURIComponent(url.split('/').pop().replace(/\.[^/.]+$/, ''));
                    const allImportedGlossaries = GM_getValue(IMPORTED_GLOSSARY_KEY, {});
                    allImportedGlossaries[url] = {
                        terms: onlineData.terms,
                        generalTerms: onlineData.generalTerms,
                        multiPartTerms: onlineData.multiPartTerms,
                        multiPartGeneralTerms: onlineData.multiPartGeneralTerms,
                        forbiddenTerms: onlineData.forbiddenTerms,
                        regexTerms: onlineData.regexTerms
                    };
                    currentMetadata[url] = { ...onlineData.metadata, last_updated: getShanghaiTimeString() };

                    GM_setValue(IMPORTED_GLOSSARY_KEY, allImportedGlossaries);
                    GM_setValue(GLOSSARY_METADATA_KEY, currentMetadata);
                    invalidateGlossaryCache();

                    GM_notification(`检测到术语表“${glossaryName}”新版本，已自动更新至 v${onlineVersion} 。`, 'AO3 汉化插件');
                }
            } catch (e) {
                if (DEBUG_MODE) {
                    console.error(`检查术语表更新失败 (${url}):`, e);
                }
            }
        }
    }

    /**
     * 获取术语表规则，优先从缓存读取
     */
    function getGlossaryRules() {
        const cache = GM_getValue(GLOSSARY_RULES_CACHE_KEY, null);
        const currentStateHash = generateGlossaryStateHash();

        if (cache && cache.hash === currentStateHash && cache.rules) {
            if (DEBUG_MODE) {
                console.log('[缓存管理] 命中术语表规则缓存。');
            }
            return cache.rules.map(rule => {
                if (rule.regex && typeof rule.regex === 'object' && rule.regex.source) {
                    try {
                        return { ...rule, regex: new RegExp(rule.regex.source, rule.regex.flags) };
                    } catch (e) {
                        if (DEBUG_MODE) {
                            console.warn('从缓存重建正则表达式失败:', rule, e);
                        }
                        return null;
                    }
                }
                return rule;
            }).filter(Boolean);
        }

        if (DEBUG_MODE) {
            console.log('[缓存管理] 缓存未命中或已失效，正在重建规则...');
        }
        return buildPrioritizedGlossaryMaps();
    }

    /**
     * 构建并排序所有术语表规则
     */
    function buildPrioritizedGlossaryMaps() {
        const allImportedGlossaries = GM_getValue(IMPORTED_GLOSSARY_KEY, {});
        const glossaryMetadata = GM_getValue(GLOSSARY_METADATA_KEY, {});
        const localGlossaryString = GM_getValue(LOCAL_GLOSSARY_STRING_KEY, '');
        const localForbiddenTerms = new Set(GM_getValue(LOCAL_FORBIDDEN_TERMS_KEY, []));

        let rules = [];
        const processedLocalKeys = new Set();

        const PRIORITY = {
            LOCAL_FORBIDDEN: 60000,
            LOCAL_TERM: 50000,
            ONLINE_FORBIDDEN: 40000,
            ONLINE_TERM: 30000,
            ONLINE_GENERAL_TERM: 20000,
            ONLINE_REGEX: 10000
        };

        const termSeparatorRegex = /[\s-－﹣—–]+/;

        function addRule(ruleConfig) {
            const { termForms, translation, type, timestamp = 0, source, originalTerm, isMultiPart, isGeneral, isUnordered = false } = ruleConfig;

            const basePriority = PRIORITY[type];
            if (basePriority === undefined) return;

            const lengthFactor = isMultiPart
                ? termForms.map(forms => Array.from(forms)[0]).join(' ').length
                : Array.from(termForms)[0].length;
            const priority = basePriority + timestamp + lengthFactor;

            const isForbidden = type.includes('FORBIDDEN');

            try {
                let ruleObject;
                if (type === 'ONLINE_REGEX') {
                    ruleObject = {
                        type: 'regex', matchStrategy: 'regex',
                        regex: new RegExp(termForms, 'g'),
                        replacement: translation, priority, source, originalTerm
                    };
                } else if (isMultiPart) {
                    ruleObject = {
                        type: isForbidden ? 'forbidden' : 'term', matchStrategy: 'dom',
                        parts: termForms,
                        replacement: isForbidden ? termForms.map(forms => Array.from(forms)[0]).join(' ') : translation,
                        priority, isGeneral, source, originalTerm, isUnordered
                    };
                } else {
                    const pattern = createSmartRegexPattern(termForms);
                    const flags = isGeneral ? 'gi' : 'g';
                    ruleObject = {
                        type: isForbidden ? 'forbidden' : 'term', matchStrategy: 'regex',
                        regex: new RegExp(pattern, flags),
                        replacement: isForbidden ? Array.from(termForms)[0] : translation,
                        priority, source, originalTerm
                    };
                }
                rules.push(ruleObject);
            } catch (e) {
                if (DEBUG_MODE) {
                    console.warn(`创建术语表规则失败: "${originalTerm}". 错误: ${e.message}`);
                }
            }
        }

        function processSinglePartTerm(term, translation, type, isLocal, timestamp, source, originalTerm) {
            const normalizedTerm = term.trim();
            if (!normalizedTerm) return;

            if (termSeparatorRegex.test(normalizedTerm)) {
                processMultiPartTerm(term, translation, type, isLocal, timestamp, source, originalTerm);
                return;
            }

            const isForbidden = type.includes('FORBIDDEN');
            const forms = generateWordForms(normalizedTerm, { preserveCase: isForbidden });

            if (isLocal || !processedLocalKeys.has(normalizedTerm.toLowerCase())) {
                addRule({ termForms: forms, translation, type, isLocal, timestamp, source, originalTerm, isMultiPart: false, isGeneral: type.includes('GENERAL') });
                if (isLocal) {
                    forms.forEach(f => processedLocalKeys.add(f.toLowerCase()));
                }
            }
        }

        function processMultiPartTerm(term, translation, type, isLocal, timestamp, source, originalTerm) {
            const normalizedTerm = term.trim();
            const isForbidden = type.includes('FORBIDDEN');
            const normalizedTranslation = !isForbidden ? translation.trim() : null;

            if (!normalizedTerm || (!normalizedTranslation && !isForbidden)) return;

            const termParts = normalizedTerm.split(termSeparatorRegex);
            if (termParts.length <= 1) {
                processSinglePartTerm(term, translation, type, isLocal, timestamp, source, originalTerm);
                return;
            }

            if (isLocal && processedLocalKeys.has(normalizedTerm.toLowerCase())) return;
            if (!isLocal && processedLocalKeys.has(normalizedTerm.toLowerCase())) return;

            const isGeneral = type.includes('GENERAL');
            const termPartsWithForms = termParts.map(part =>
                Array.from(generateWordForms(part, { preserveCase: isForbidden || isGeneral }))
            );

            const isUnorderedEligible = (type === 'LOCAL_TERM' || type === 'ONLINE_TERM');

            addRule({
                termForms: termPartsWithForms,
                translation: normalizedTranslation,
                type,
                isLocal,
                timestamp,
                source,
                originalTerm: originalTerm,
                isMultiPart: true,
                isGeneral,
                isUnordered: isUnorderedEligible
            });

            if (!isForbidden && originalTerm.includes('=')) {
                const translationParts = normalizedTranslation.split(/[\s·・]+/);
                if (termParts.length === translationParts.length) {
                    termParts.forEach((part, i) => {
                        processSinglePartTerm(part, translationParts[i], type, isLocal, timestamp, source, `${part} -> ${translationParts[i]} (from: ${originalTerm})`);
                    });
                }
            }

            if (isLocal) {
                processedLocalKeys.add(normalizedTerm.toLowerCase());
            }
        }

        localForbiddenTerms.forEach(term => {
            processSinglePartTerm(term, null, 'LOCAL_FORBIDDEN', true, 0, '本地禁翻', term);
        });

        if (localGlossaryString.trim()) {
            localGlossaryString.replace(/[，,]/g, '|||').split('|||').forEach(entry => {
                const normalizedEntry = entry.replace(/[：＝]/g, (match) => ({ '：': ':', '＝': '=' }[match]));
                const multiPartMatch = normalizedEntry.match(/^\s*(.+?)\s*=\s*(.+?)\s*$/);
                if (multiPartMatch) {
                    processMultiPartTerm(multiPartMatch[1], multiPartMatch[2], 'LOCAL_TERM', true, 0, '本地术语', entry.trim());
                    return;
                }
                const singlePartMatch = normalizedEntry.match(/^\s*(.+?)\s*:\s*(.+?)\s*$/);
                if (singlePartMatch) {
                    processSinglePartTerm(singlePartMatch[1], singlePartMatch[2], 'LOCAL_TERM', true, 0, '本地术语', entry.trim());
                }
            });
        }

        const sortedOnlineGlossaryUrls = Object.keys(allImportedGlossaries)
            .filter(url => glossaryMetadata[url] && glossaryMetadata[url].enabled !== false)
            .sort((a, b) => {
                const timeA = new Date(glossaryMetadata[a]?.last_imported || 0).getTime();
                const timeB = new Date(glossaryMetadata[b]?.last_imported || 0).getTime();
                return timeB - timeA;
            });

        sortedOnlineGlossaryUrls.forEach((url, index) => {
            const g = allImportedGlossaries[url];
            if (!g) return;
            const timestamp = index * 0.001;
            const sourceName = `在线: ${decodeURIComponent(url.split('/').pop())}`;

            (g.forbiddenTerms || []).forEach(term => processSinglePartTerm(term, null, 'ONLINE_FORBIDDEN', false, timestamp, sourceName, term));
            Object.entries(g.terms || {}).forEach(([k, v]) => processSinglePartTerm(k, v, 'ONLINE_TERM', false, timestamp, sourceName, `${k}:${v}`));
            Object.entries(g.generalTerms || {}).forEach(([k, v]) => processSinglePartTerm(k, v, 'ONLINE_GENERAL_TERM', false, timestamp, sourceName, `${k}:${v}`));
            Object.entries(g.multiPartTerms || {}).forEach(([k, v]) => processMultiPartTerm(k, v, 'ONLINE_TERM', false, timestamp, sourceName, `${k}=${v}`));
            Object.entries(g.multiPartGeneralTerms || {}).forEach(([k, v]) => processMultiPartTerm(k, v, 'ONLINE_GENERAL_TERM', false, timestamp, sourceName, `${k}=${v}`));
            (g.regexTerms || []).forEach(({ pattern, replacement }) => {
                if (!processedLocalKeys.has(pattern.toLowerCase())) {
                    addRule({ termForms: pattern, translation: replacement, type: 'ONLINE_REGEX', isLocal: false, timestamp, source: sourceName, originalTerm: `${pattern}:${replacement}` });
                }
            });
        });

        rules.sort((a, b) => b.priority - a.priority);

        const currentStateHash = generateGlossaryStateHash();
        const serializedRules = rules.map(rule => {
            if (rule.regex instanceof RegExp) {
                return { ...rule, regex: { source: rule.regex.source, flags: rule.regex.flags } };
            }
            return rule;
        });

        GM_setValue(GLOSSARY_RULES_CACHE_KEY, {
            hash: currentStateHash,
            rules: serializedRules
        });

        if (DEBUG_MODE) {
            console.log('[缓存管理] 术语表规则已重建并存入缓存。');
        }

        return rules;
    }


    /**
     * 为单个英文单词生成其常见词形变体
     */
    function generateWordForms(baseTerm, options = {}) {
        const { preserveCase = false } = options;
        const forms = new Set();
        if (!baseTerm || typeof baseTerm !== 'string') {
            return forms;
        }

        forms.add(baseTerm);

        const lowerBase = baseTerm.toLowerCase();
        let pluralEnding;
        let baseWithoutEnding = baseTerm;

        if (lowerBase.endsWith('y') && !['a', 'e', 'i', 'o', 'u'].includes(lowerBase.slice(-2, -1))) {
            pluralEnding = 'ies';
            baseWithoutEnding = baseTerm.slice(0, -1);
        } else if (/[sxz]$/i.test(lowerBase) || /(ch|sh)$/i.test(lowerBase)) {
            pluralEnding = 'es';
        } else {
            pluralEnding = 's';
        }

        let pluralForm;
        if (preserveCase) {
            if (baseTerm === lowerBase) {
                pluralForm = baseWithoutEnding + pluralEnding;
            } else if (baseTerm === baseTerm.toUpperCase()) {
                pluralForm = (baseWithoutEnding + pluralEnding).toUpperCase();
            } else if (baseTerm.length > 0 && baseTerm[0] === baseTerm[0].toUpperCase() && baseTerm.slice(1) === baseTerm.slice(1).toLowerCase()) {
                const pluralBase = baseWithoutEnding + pluralEnding;
                pluralForm = pluralBase.charAt(0).toUpperCase() + pluralBase.slice(1).toLowerCase();
            } else {
                pluralForm = baseWithoutEnding + pluralEnding.toLowerCase();
            }
        } else {
            pluralForm = baseWithoutEnding + pluralEnding;
        }

        forms.add(pluralForm);
        return forms;
    }

    /**
     * 解析并保存“译文后处理替换”规则
     */
    function processAndSavePostReplaceRules(rawInput) {
        const rules = {
            singleRules: {},
            multiPartRules: []
        };

        if (typeof rawInput !== 'string' || !rawInput.trim()) {
            GM_setValue(POST_REPLACE_MAP_KEY, rules);
            return;
        }

        const internalSeparatorRegex = /[\s-－﹣—–]+/;
        const internalSeparatorGlobalRegex = /[\s-－﹣—–]+/g;

        rawInput.split(/[，,]/).forEach(entry => {
            const trimmedEntry = entry.trim();
            if (!trimmedEntry) return;

            const multiPartMatch = trimmedEntry.match(/^(.*?)\s*[=＝]\s*(.*?)$/);
            if (multiPartMatch) {
                const source = multiPartMatch[1].trim();
                const target = multiPartMatch[2].trim();

                if (source && target) {
                    const sourceParts = source.split(internalSeparatorRegex);
                    const targetParts = target.split(internalSeparatorRegex);
                    const multiPartRule = {
                        source: source.replace(internalSeparatorGlobalRegex, ' '),
                        target: target.replace(internalSeparatorGlobalRegex, ' '),
                        subRules: {}
                    };

                    if (sourceParts.length === targetParts.length && sourceParts.length > 1) {
                        for (let i = 0; i < sourceParts.length; i++) {
                            multiPartRule.subRules[sourceParts[i]] = targetParts[i];
                        }
                    }
                    rules.multiPartRules.push(multiPartRule);
                }
            } else {
                const singlePartMatch = trimmedEntry.match(/^(.*?)\s*[:：]\s*(.+?)\s*$/);
                if (singlePartMatch) {
                    const key = singlePartMatch[1].trim();
                    const value = singlePartMatch[2].trim();
                    if (key) {
                        rules.singleRules[key] = value;
                    }
                }
            }
        });

        GM_setValue(POST_REPLACE_MAP_KEY, rules);
    }

    /**
     * 译文后处理替换
     */
    function applyPostTranslationReplacements(text) {
        const rulesData = GM_getValue(POST_REPLACE_MAP_KEY, null);

        if (!rulesData || typeof rulesData !== 'object' || Array.isArray(rulesData)) {
            return text;
        }

        const { singleRules = {}, multiPartRules = [] } = rulesData;
        const finalReplacementMap = {};

        multiPartRules.forEach(rule => {
            Object.assign(finalReplacementMap, rule.subRules);
        });

        Object.assign(finalReplacementMap, singleRules);

        multiPartRules.forEach(rule => {
            finalReplacementMap[rule.source] = rule.target;
        });

        const keys = Object.keys(finalReplacementMap);
        if (keys.length === 0) {
            return text;
        }

        const sortedKeys = keys.sort((a, b) => b.length - a.length);

        const regex = new RegExp(sortedKeys.map(key => key.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|'), 'g');

        return text.replace(regex, (matched) => finalReplacementMap[matched]);
    }

    /**
     * 显示通知时打印到控制台
     */
    function notifyAndLog(message, title = 'AO3 汉化插件', logType = 'info') {
        GM_notification(message, title);
        if (DEBUG_MODE) {
            const logFunction = console[logType] || console.log;
            logFunction(`[${title}] ${message}`);
        }
    }

    /**
     * sleepms 函数：延时。
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 获取当前时间的上海时区格式化字符串
     */
    function getShanghaiTimeString() {
        const now = new Date();
        const year = now.toLocaleString('en-US', { year: 'numeric', timeZone: 'Asia/Shanghai' });
        const month = now.toLocaleString('en-US', { month: '2-digit', timeZone: 'Asia/Shanghai' });
        const day = now.toLocaleString('en-US', { day: '2-digit', timeZone: 'Asia/Shanghai' });
        const time = now.toLocaleString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: 'Asia/Shanghai'
        });
        return `${year}-${month}-${day} ${time}`;
    }

    /**
     * 为字符串生成一个哈希值
     */
    function simpleStringHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash |= 0;
        }
        return hash;
    }

    /**
     * 根据术语表内容生成一个状态哈希
     */
    function generateGlossaryStateHash() {
        const localGlossary = GM_getValue(LOCAL_GLOSSARY_STRING_KEY, '');
        const localForbidden = GM_getValue(LOCAL_FORBIDDEN_STRING_KEY, '');

        const metadata = GM_getValue(GLOSSARY_METADATA_KEY, {});
        const enabledOnlineGlossaries = Object.keys(metadata)
            .filter(url => metadata[url] && metadata[url].enabled !== false)
            .sort()
            .map(url => `${url}@${metadata[url].version}`)
            .join(';');

        const combinedStateString = [
            localGlossary,
            localForbidden,
            enabledOnlineGlossaries
        ].join('|||');

        return simpleStringHash(combinedStateString);
    }

    /**
     * 使术语表规则缓存失效
     */
    function invalidateGlossaryCache() {
        GM_deleteValue(GLOSSARY_RULES_CACHE_KEY);
        if (DEBUG_MODE) {
            console.log('[缓存管理] 术语表规则缓存已失效。');
        }
    }

    /**
     * getNestedProperty 函数：获取嵌套属性的安全函数。
     * @param {Object} obj - 需要查询的对象
     * @param {string} path - 属性路径
     * @returns {*} - 返回嵌套属性的值
     */
    function getNestedProperty(obj, path) {
        return path.split('.').reduce((acc, part) => {
            const match = part.match(/(\w+)(?:\[(\d+)\])?/);
            if (!match) return undefined;
            const key = match[1];
            const index = match[2];
            if (acc && typeof acc === 'object' && acc[key] !== undefined) {
                return index !== undefined ? acc[key][index] : acc[key];
            }
            return undefined;
        }, obj);
    }

    /**
     * 辅助函数：获取当前选择的 AI 服务的具体模型ID
     */
    function getCurrentModelId(engineName) {
        if (engineName.startsWith('custom_')) {
            const services = GM_getValue(CUSTOM_SERVICES_LIST_KEY, []);
            const service = services.find(s => s.id === engineName);
            if (!service) return 'default-model';
            return GM_getValue(`${ACTIVE_MODEL_PREFIX_KEY}${engineName}`, (service.models || [])[0] || 'default-model');
        }

        const config = engineMenuConfig[engineName];
        if (config && config.modelGmKey) {
            const defaultModel = config.modelMapping ? Object.keys(config.modelMapping)[0] : 'default-model';
            return GM_getValue(config.modelGmKey, defaultModel);
        }

        return 'glm-4-flash-250414';
    }

	/**
	 * 翻译文本处理函数
	 */
	const AdvancedTranslationCleaner = new (class {
		constructor() {
			this.metaKeywords = [
				'原文', '输出', '说明', '润色', '语境', '遵守', '指令',
				'Original text', 'Output', 'Note', 'Stage', 'Strategy', 'Polish', 'Retain', 'Glossary', 'Adherence'
			];
			this.junkLineRegex = new RegExp(`^\\s*(\\d+\\.\\s*)?(${this.metaKeywords.join('|')})[:：\\s]`, 'i');
			this.lineNumbersRegex = /^\d+\.\s*/;
			this.aiGenericExplanationRegex = /\s*\uff08(?:原文|译文|说明|保留|注释)[:：\s][^\uff08\uff09]*?\uff09\s*/g;
            this.fillerWordsRegex = /(?<![a-zA-Z])(emm|hmm|ah|uh|er|um|uhm)(?![a-zA-Z])/gi;
            this.possessiveRegex = /([a-zA-Z\u4e00-\u9fa5]+(?:s|es|ies)?)\s*['’‘](s\b)?/g;
            this.cjkCharsAndPunctuation = '\\u4e00-\\u9fa5\\u3000-\\u303f\\uff00-\\uffef';
		}

		clean(text) {
			if (!text || typeof text !== 'string') {
				return '';
			}

			let cleanedText = text.split('\n').filter(line => !this.junkLineRegex.test(line)).join('\n');
			cleanedText = cleanedText.replace(this.lineNumbersRegex, '');
            cleanedText = cleanedText.replace(this.aiGenericExplanationRegex, '');
            cleanedText = cleanedText.replace(this.fillerWordsRegex, ' ');
            cleanedText = cleanedText.replace(this.possessiveRegex, (match, p1, p2) => {
                if (p2 !== undefined || /[sS]$/.test(p1)) {
                    return p1 + '的';
                }
                return match;
            });

            cleanedText = cleanedText.replace(/的\s*的/g, '的');

			cleanedText = cleanedText.replace(/(<(em|strong|span|b|i|u)[^>]*>)([\s\S]*?)(<\/\2>)/g, (_match, openTag, _tagName, content, closeTag) => {
				return openTag + content.trim() + closeTag;
			});

			const cjkBlock = `([${this.cjkCharsAndPunctuation}]+)`;
			const latinBlock = `([a-zA-Z0-9_.-]+)`;
            const separator = `((?:</?(?:strong|em|code|b|i|u)>|\\s|["':,.\\[\\]@])*?)`;

			cleanedText = cleanedText.replace(new RegExp(`${cjkBlock}${separator}${latinBlock}`, 'g'), '$1 $2$3');
			cleanedText = cleanedText.replace(new RegExp(`${latinBlock}${separator}${cjkBlock}`, 'g'), '$1$2 $3');

            cleanedText = cleanedText.replace(/(“|‘|「|『)\s+/g, '$1');
            cleanedText = cleanedText.replace(/\s+(”|’|」|』)/g, '$1');

            let previousText;
            const simpleFormattingTags = `</?(?:em|strong|span|b|i|u)>`;
            const cjkContext = `(?:[${this.cjkCharsAndPunctuation}]|${simpleFormattingTags})`;

            do {
                previousText = cleanedText;
                cleanedText = cleanedText.replace(/\s+/g, ' ');
                cleanedText = cleanedText.replace(new RegExp(`(${cjkContext})\\s+(${cjkContext})`, 'g'), '$1$2');
            } while (previousText !== cleanedText);

			return cleanedText.trim();
		}
	})();

    /**
     * 通用后处理函数：处理块级元素末尾的孤立标点
     */
    function handleTrailingPunctuation(rootElement = document) {
        const selectors = 'p, li, dd, blockquote, h1, h2, h3, h4, h5, h6, .summary, .notes';
        const punctuationMap = { '.': ' 。', '?': ' ？', '!': ' ！' };

        const elements = rootElement.querySelectorAll(`${selectors}:not([data-translated-by-custom-function])`);

        elements.forEach(el => {
            let lastMeaningfulNode = el.lastChild;

            while (lastMeaningfulNode) {
                if (lastMeaningfulNode.nodeType === Node.COMMENT_NODE ||
                (lastMeaningfulNode.nodeType === Node.TEXT_NODE && lastMeaningfulNode.nodeValue.trim() === ''))
                {
                    lastMeaningfulNode = lastMeaningfulNode.previousSibling;
                } else {
                    break;
                }
            }
            if (
                lastMeaningfulNode &&
                lastMeaningfulNode.nodeType === Node.TEXT_NODE
            ) {
                const trimmedText = lastMeaningfulNode.nodeValue.trim();

                if (punctuationMap[trimmedText]) {
                    lastMeaningfulNode.nodeValue = lastMeaningfulNode.nodeValue.replace(trimmedText, punctuationMap[trimmedText]);
                    el.setAttribute('data-translated-by-custom-function', 'true');
                }
            }
        });
    }

    /**
     * 通用函数：对页面上所有“分类”复选框区域进行重新排序。
     */
    function reorderCategoryCheckboxes() {
        const containers = document.querySelectorAll('div[id$="_category_tagnames_checkboxes"]');

        containers.forEach(container => {
            if (container.dataset.reordered === 'true') {
                return;
            }

            const list = container.querySelector('ul.options');
            if (!list) return;

            const desiredOrder = ['F/F', 'F/M', 'Gen', 'M/M', 'Multi', 'Other'];
            const itemsMap = new Map();

            list.querySelectorAll('li').forEach(item => {
                const checkbox = item.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    itemsMap.set(checkbox.value, item);
                }
            });

            desiredOrder.forEach(value => {
                const itemToMove = itemsMap.get(value);
                if (itemToMove) {
                    list.appendChild(itemToMove);
                }
            });

            container.dataset.reordered = 'true';
        });
    }

    /**
     * 通用函数：重新格式化包含标准日期组件的元素。
     * @param {Element} containerElement - 直接包含日期组件的元素
     */
    function reformatDateInElement(containerElement) {
        if (!containerElement || containerElement.hasAttribute('data-reformatted')) {
            return;
        }
        const dayEl = containerElement.querySelector('abbr.day');
        const dateEl = containerElement.querySelector('span.date');
        const monthEl = containerElement.querySelector('abbr.month');
        const yearEl = containerElement.querySelector('span.year');

        if (!dayEl || !dateEl || !monthEl || !yearEl) {
            return;
        }

        // 翻译星期
        let dayFull = dayEl.getAttribute('title');
        dayFull = fetchTranslatedText(dayFull) || dayFull;

        // 翻译月份
        const monthText = monthEl.textContent;
        const translatedMonth = fetchTranslatedText(monthText) || monthText;

        // 格式化时间
        const timeEl = containerElement.querySelector('span.time');
        let formattedTime = '';
        if (timeEl) {
            const timeText = timeEl.textContent;
            const T = timeText.slice(0, -2);
            const ampm = timeText.slice(-2);
            if (ampm === 'PM') {
                formattedTime = '下午 ' + T;
            } else if (ampm === 'AM') {
                formattedTime = (T.startsWith('12') ? '凌晨 ' : '上午 ') + T;
            } else {
                formattedTime = timeText;
            }
        }

        // 提取时区
        const timezoneEl = containerElement.querySelector('abbr.timezone');
        const timezoneText = timezoneEl ? timezoneEl.textContent : 'UTC';

        // 替换内容
        const prefixNode = containerElement.firstChild;
        let prefixText = '';
        if (prefixNode && prefixNode.nodeType === Node.TEXT_NODE) {
            prefixText = prefixNode.nodeValue;
        }
        containerElement.innerHTML = '';
        if (prefixText) {
            containerElement.appendChild(document.createTextNode(prefixText));
        }
        containerElement.appendChild(document.createTextNode(`${yearEl.textContent}年${translatedMonth}${dateEl.textContent}日 ${dayFull} ${formattedTime} ${timezoneText}`));

        containerElement.setAttribute('data-reformatted', 'true');
    }

    /**
     * 执行一次性数据迁移，将旧版存储格式更新为新版，确保向后兼容性
     */
    function runDataMigration() {
        (function() {
            const postReplaceData = GM_getValue(POST_REPLACE_MAP_KEY, null);
            if (postReplaceData && typeof postReplaceData === 'object' && !postReplaceData.hasOwnProperty('singleRules')) {
                const newRules = {
                    singleRules: postReplaceData,
                    multiPartRules: []
                };
                GM_setValue(POST_REPLACE_MAP_KEY, newRules);
            }
        })();

        (function() {
            const oldGlossaryObject = GM_getValue(LOCAL_GLOSSARY_KEY, null);
            const veryOldGlossaryObject = GM_getValue('ao3_translation_glossary', null);
            const targetStringKeyExists = GM_getValue(LOCAL_GLOSSARY_STRING_KEY, null) !== null;

            if (targetStringKeyExists) return;

            let glossaryToMigrate = null;
            if (oldGlossaryObject && typeof oldGlossaryObject === 'object') {
                glossaryToMigrate = oldGlossaryObject;
                GM_deleteValue(LOCAL_GLOSSARY_KEY);
            } else if (veryOldGlossaryObject && typeof veryOldGlossaryObject === 'object') {
                glossaryToMigrate = veryOldGlossaryObject;
                GM_deleteValue('ao3_translation_glossary');
            }

            if (glossaryToMigrate) {
                const newGlossaryString = Object.entries(glossaryToMigrate).map(([k, v]) => `${k}:${v}`).join(', ');
                GM_setValue(LOCAL_GLOSSARY_STRING_KEY, newGlossaryString);
            }
        })();

        (function() {
            const servicesToMigrate = ['zhipu_ai', 'deepseek_ai', 'groq_ai', 'together_ai', 'cerebras_ai', 'modelscope_ai'];
            servicesToMigrate.forEach(serviceName => {
                const oldKey = `${serviceName.split('_')[0]}_api_key`;
                const newStringKey = `${serviceName}_keys_string`;
                const newArrayKey = `${serviceName}_keys_array`;
                const oldKeyValue = GM_getValue(oldKey, null);

                if (oldKeyValue && GM_getValue(newStringKey, null) === null) {
                    GM_setValue(newStringKey, oldKeyValue);
                    const keysArray = oldKeyValue.replace(/[，]/g, ',').split(',').map(k => k.trim()).filter(Boolean);
                    GM_setValue(newArrayKey, keysArray);
                    GM_deleteValue(oldKey);
                }
            });

            const oldChatglmKey = GM_getValue('chatglm_api_key', null);
            if (oldChatglmKey && GM_getValue('zhipu_ai_keys_string', null) === null) {
                GM_setValue('zhipu_ai_keys_string', oldChatglmKey);
                GM_setValue('zhipu_ai_keys_array', [oldChatglmKey]);
                GM_deleteValue('chatglm_api_key');
            }
        })();

        (function() {
            const oldDataArray = GM_getValue(LOCAL_FORBIDDEN_TERMS_KEY, null);
            const newDataExists = GM_getValue(LOCAL_FORBIDDEN_STRING_KEY, null) !== null;
            if (oldDataArray && Array.isArray(oldDataArray) && !newDataExists) {
                const newStringData = oldDataArray.join(', ');
                GM_setValue(LOCAL_FORBIDDEN_STRING_KEY, newStringData);
            }
        })();

        (function() {
            const oldKeysArray = GM_getValue('google_ai_keys_array', null);
            const newKeysStringExists = GM_getValue('google_ai_keys_string', null) !== null;
            if (oldKeysArray && Array.isArray(oldKeysArray) && !newKeysStringExists) {
                const newKeysString = oldKeysArray.join(', ');
                GM_setValue('google_ai_keys_string', newKeysString);
            }
        })();
    }

    /**
     * 脚本主入口，初始化所有功能
     */
    function main() {
        runDataMigration();
		checkForGlossaryUpdates();

		const fabElements = createFabUI();
		const panelElements = createSettingsPanelUI();
        let rerenderMenu;
        let fabLogic;

        const handlePanelClose = () => {
            if (fabLogic) {
                fabLogic.retractFab();
            }
        };

        const panelLogic = initializeSettingsPanelLogic(panelElements, () => rerenderMenu(), handlePanelClose);
		fabLogic = initializeFabInteraction(fabElements, panelLogic);

		const globalStyles = document.createElement('style');
		globalStyles.textContent = `
			.autocomplete.dropdown p.notice {
				margin-bottom: 0;
			}
		`;
		document.head.appendChild(globalStyles);
		if (document.documentElement.lang !== CONFIG.LANG) {
			document.documentElement.lang = CONFIG.LANG;
		}
		new MutationObserver(() => {
			if (document.documentElement.lang !== CONFIG.LANG && document.documentElement.lang.toLowerCase().startsWith('en')) {
				document.documentElement.lang = CONFIG.LANG;
			}
		}).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
		updatePageConfig('初始载入');
		if (pageConfig.currentPageType) {
			transTitle();
			transBySelector();
			traverseNode(document.body);
			runHighPriorityFunctions();
			fabLogic.toggleFabVisibility();
			if (FeatureSet.enable_transDesc) {
				setTimeout(transDesc, 1000);
			}
		}
        rerenderMenu = setupMenuCommands(fabLogic, panelLogic);
        rerenderMenu();
		watchUpdate(fabLogic);
	}

    /**
     * watchUpdate 函数：监视页面变化，根据变化的节点进行翻译。
     */
    function watchUpdate(fabLogic) {
		let previousURL = window.location.href;

		const handleUrlChange = () => {
			const currentURL = window.location.href;
			if (currentURL !== previousURL) {
				previousURL = currentURL;
				updatePageConfig('URL变化');
				transTitle();
				transBySelector();
				traverseNode(document.body);
				runHighPriorityFunctions();
				fabLogic.toggleFabVisibility();
				if (FeatureSet.enable_transDesc) {
					transDesc();
				}
			}
		};

		const processMutations = mutations => {
			const nodesToProcess = mutations.flatMap(({ target, addedNodes, type }) => {
				if (type === 'childList' && addedNodes.length > 0) {
					return Array.from(addedNodes);
				}
				if (type === 'attributes' || (type === 'characterData' && pageConfig.characterData)) {
					return [target];
				}
				return [];
			});

			if (nodesToProcess.length === 0) return;

			const uniqueNodes = [...new Set(nodesToProcess)];
			uniqueNodes.forEach(node => {
				if (node.nodeType === Node.ELEMENT_NODE || node.parentElement) {
					traverseNode(node);
					runHighPriorityFunctions(node.parentElement || node);
				}
			});

			fabLogic.toggleFabVisibility();
			if (FeatureSet.enable_transDesc) {
				transDesc();
			}
		};

		const observer = new MutationObserver(mutations => {
			handleUrlChange();
			if (window.location.href === previousURL) {
				processMutations(mutations);
			}
		});

		observer.observe(document.documentElement, { ...CONFIG.OBSERVER_CONFIG, subtree: true });
	}

    /**
     * 辅助函数：集中调用所有高优先级专用函数
     * @param {HTMLElement} [rootElement=document] - 扫描范围
     */
    function runHighPriorityFunctions(rootElement = document) {
        if (!rootElement || typeof rootElement.querySelectorAll !== 'function') {
            return;
        }
        const innerHTMLRules = pageConfig.innerHTMLRules || [];
        if (innerHTMLRules.length > 0) {
            innerHTMLRules.forEach(rule => {
                if (!Array.isArray(rule) || rule.length !== 3) return;
                const [selector, regex, replacement] = rule;
                try {
                    rootElement.querySelectorAll(selector).forEach(el => {
                        if (el.hasAttribute('data-translated-by-custom-function')) return;
                        if (regex.test(el.innerHTML)) {
                            el.innerHTML = el.innerHTML.replace(regex, replacement);
                            el.setAttribute('data-translated-by-custom-function', 'true');
                        }
                    });
                } catch (e) { /* 忽略无效的选择器 */ }
            });
        }
        const kudosDiv = rootElement.querySelector('#kudos');
        if (kudosDiv && !kudosDiv.dataset.kudosObserverAttached) {
            translateKudosSection();
        }

        // 通用的后处理和格式化函数
        handleTrailingPunctuation(rootElement);
        translateSymbolsKeyModal(rootElement);
        translateFirstLoginBanner();
        translateBookmarkSymbolsKeyModal();
        translateRatingHelpModal();
        translateCategoriesHelp();
        translateRelationshipsHelp();
        translateCharactersHelp();
        translateAdditionalTagsHelp();
        translateCollectionsHelp();
        translateRecipientsHelp();
        translateParentWorksHelp();
        translateChoosingSeriesHelp();
        translateBackdatingHelp();
        translateLanguagesHelp();
        translateWorkSkins();
        translateRegisteredUsers();
        translateCommentsModerated();
        translateFandomHelpModal();
        translateWhoCanComment();
        translateWorkImportTroubleshooting();
        translateEncodingHelp();
        translatePrivacyPreferences();
        translateDisplayPreferences();
        translateSkinsBasics();
        translateWorkTitleFormat();
        translateCommentPreferences();
        translateCollectionPreferences();
        translateMiscPreferences();
        translateTagFiltersIncludeTags();
        translateTagFiltersExcludeTags();
        translateBookmarkFiltersIncludeTags();
        translateWorkSearchTips();
        translateChapterTitleHelpModal();
        translateActionButtons();
        translateSortButtons();
        translateBookmarkFiltersExcludeTags();
        translateSearchResultsHeader();
        translateWorkSearchResultsHelp();
        translateSkinsApprovalModal();
        translateSkinsCreatingModal();
        translateSkinsConditionsModal();
        translateSkinsParentsModal();
        translateSkinsWizardFontModal();
        translateSkinsWizardFontSizeModal();
        translateSkinsWizardVerticalGapModal();
        translateSkinsWizardAccentColorModal();
        translateCollectionNameHelpModal();
        translateIconAltTextHelpModal();
        translatePseudIconCommentHelpModal();
        translateCollectionModeratedHelpModal();
        translateCollectionClosedHelpModal();
        translateTagSearchResultsHelp();
        translateChallengeAnyTips();
        translateOptionalTagsHelp();
        translateBookmarkSearchTips();
        translateWarningHelpModal();
        translateHtmlHelpModal();
		translateRteHelpModal();
        translateBookmarkSearchResultsHelpModal();
        translateTagsetAboutModal();
        translateFlashMessages();
        translateTagSetsHeading();
        translateFoundResultsHeading();
        translateTOSPrompt();
		translateHeadingTags();
        // 统一寻找并重新格式化所有日期容器
        const dateSelectors = [
            '.header.module .meta span.published',
            'li.collection .summary p:has(abbr.day)',
            '.comment .posted.datetime',
            '.comment .edited.datetime',
            'dd.datetime',
            'p:has(> span.datetime)',
            'p.caution.notice > span:has(abbr.day)',
            'p.notice > span:has(abbr.day)',
        ];
        rootElement.querySelectorAll(dateSelectors.join(', '))
            .forEach(reformatDateInElement);
        // 根据当前页面类型，调用页面专属的翻译和处理函数
        const pageType = pageConfig.currentPageType;

        if (pageType === 'about_page') {
            translateAboutPage();
        }

        if (pageType === 'diversity_statement') {
            translateDiversityStatement();
        }

        if (pageType === 'donate_page') {
            translateDonatePage();
        }

        if (pageType === 'tag_sets_new' || pageType === 'collections_dashboard_common') {
            reorderCategoryCheckboxes();
        }

        if (pageType === 'front_page') {
            translateFrontPageIntro();
        }

        if (pageType === 'invite_requests_index') {
            translateInvitationRequestsPage();
        }

        if (pageType === 'error_too_many_requests') {
            translateTooManyRequestsPage();
        }

        if (pageType === 'works_search') {
            translateWorkSearchDateTips();
            translateWorkSearchCrossoverTips();
            translateWorkSearchNumericalTips();
            translateWorkSearchLanguageTips();
            translateWorkSearchTagsTips();
        }

        if (pageType === 'people_search') {
            translatePeopleSearchTips();
        }

        if (pageType === 'bookmarks_search') {
            translateBookmarkSearchWorkTagsTips();
            translateBookmarkSearchTypeTips();
            translateBookmarkSearchDateUpdatedTips();
            translateBookmarkSearchBookmarkerTagsTips();
            translateBookmarkSearchRecTips();
            translateBookmarkSearchNotesTips();
            translateBookmarkSearchDateBookmarkedTips();
        }

        if (pageType === 'tags_search') {
            translateTagSearchTips();
        }
    }

    /**
     * 更新页面设置
     */
    function updatePageConfig() {
        const newType = detectPageType();
        if (newType && newType !== pageConfig.currentPageType) {
            pageConfig = buildPageConfig(newType);
        } else if (!pageConfig.currentPageType && newType) {
            pageConfig = buildPageConfig(newType);
        }
    }

    /**
     * 构建页面设置 pageConfig 对象
     */
    function buildPageConfig(pageType = pageConfig.currentPageType) {
        const inheritanceMap = {
            'admin_posts_index': 'admin_posts_show'
        };
        const effectivePageType = inheritanceMap[pageType] || pageType;

        const baseStatic = I18N[CONFIG.LANG]?.public?.static || {};
        const baseRegexp = I18N[CONFIG.LANG]?.public?.regexp || [];
        const baseSelector = I18N[CONFIG.LANG]?.public?.selector || [];
        const baseInnerHTMLRegexp = I18N[CONFIG.LANG]?.public?.innerHTML_regexp || [];
        const globalFlexible = (effectivePageType === 'admin_posts_show') ? {} : (I18N[CONFIG.LANG]?.flexible || {});

        const usersCommonStatic = (pageType.startsWith('users_') || pageType === 'profile' || pageType === 'dashboard')
            ? I18N[CONFIG.LANG]?.users_common?.static || {}
            : {};

        const pageStatic = I18N[CONFIG.LANG]?.[effectivePageType]?.static || {};
        const pageRegexp = I18N[CONFIG.LANG]?.[effectivePageType]?.regexp || [];
        const pageSelector = I18N[CONFIG.LANG]?.[effectivePageType]?.selector || [];
        const pageInnerHTMLRegexp = I18N[CONFIG.LANG]?.[effectivePageType]?.innerHTML_regexp || [];
        let pageFlexible = (effectivePageType === 'admin_posts_show') ? {} : (I18N[CONFIG.LANG]?.[effectivePageType]?.flexible || {});

        const parentPageMap = {
            'works_edit': 'works_new',
            'works_edit_tags': 'works_new',
            'chapters_new': 'works_new',
            'chapters_edit': 'chapters_new',
            'works_edit_multiple': 'works_new'
        };

        const parentPageType = parentPageMap[pageType];
        let extraStatic = {}, extraRegexp = [], extraSelector = [], extraInnerHTMLRegexp = [], extraFlexible = {};

        if (parentPageType) {
            const parentConfig = I18N[CONFIG.LANG]?.[parentPageType];
            if (parentConfig) {
                const parentFullConfig = buildPageConfig(parentPageType);
                extraStatic = parentFullConfig.staticDict;
                extraRegexp = parentFullConfig.regexpRules;
                extraSelector = parentFullConfig.tranSelectors;
                extraInnerHTMLRegexp = parentFullConfig.innerHTMLRules;
                extraFlexible = { ...parentFullConfig.globalFlexibleDict, ...parentFullConfig.pageFlexibleDict };
            }
        }

        const mergedStatic = { ...baseStatic, ...usersCommonStatic, ...extraStatic, ...pageStatic };
        const mergedRegexp = [...pageRegexp, ...extraRegexp, ...baseRegexp];
        const mergedSelector = [...pageSelector, ...extraSelector, ...baseSelector];
        const mergedInnerHTMLRegexp = [...pageInnerHTMLRegexp, ...extraInnerHTMLRegexp, ...baseInnerHTMLRegexp];
        const mergedPageFlexible = { ...extraFlexible, ...pageFlexible };

        return {
            currentPageType: pageType,
            staticDict: mergedStatic,
            regexpRules: mergedRegexp,
            innerHTMLRules: mergedInnerHTMLRegexp,
            globalFlexibleDict: globalFlexible,
            pageFlexibleDict: mergedPageFlexible,
            ignoreMutationSelectors: [
                ...(I18N.conf.ignoreMutationSelectorPage['*'] || []),
                ...(I18N.conf.ignoreMutationSelectorPage[pageType] || [])
            ].join(', ') || ' ',
            ignoreSelectors: [
                ...(I18N.conf.ignoreSelectorPage['*'] || []),
                ...(I18N.conf.ignoreSelectorPage[pageType] || [])
            ].join(', ') || ' ',
            characterData: I18N.conf.characterDataPage.includes(pageType),
            tranSelectors: mergedSelector,
        };
    }

    /**
     * detectPageType 函数：检测当前页面类型，基于URL。
     */
    function detectPageType() {

        if (document.title.includes("You're clicking too fast!")) {
             const h2 = document.querySelector('main h2');
            if (h2 && h2.textContent.includes('Too many page requests too quickly')) {
                return 'error_too_many_requests';
            }
        }

        if (document.querySelector('ul.media.fandom.index.group')) return 'media_index';
        if (document.querySelector('div#main.owned_tag_sets-show')) return 'owned_tag_sets_show';
        const { pathname } = window.location;
        if (pathname.startsWith('/first_login_help')) {
            return false;
        }
        if (pathname === '/abuse_reports/new' || pathname === '/support') return 'report_and_support_page';
        if (pathname === '/known_issues') return 'known_issues_page';
        if (pathname === '/tos') return 'tos_page';
        if (pathname === '/content') return 'content_policy_page';
        if (pathname === '/privacy') return 'privacy_policy_page';
        if (pathname === '/dmca') return 'dmca_policy_page';
        if (pathname === '/tos_faq') return 'tos_faq_page';
        if (pathname === '/abuse_reports/new') return 'abuse_reports_new';
        if (pathname === '/support') return 'support_page';
        if (pathname === '/diversity') return 'diversity_statement';
        if (pathname === '/site_map') return 'site_map';
        if (pathname.startsWith('/wrangling_guidelines')) return 'wrangling_guidelines_page';
        if (pathname === '/donate') return 'donate_page';
        if (pathname.startsWith('/faq')) return 'faq_page';
        if (pathname === '/help/skins-basics.html') return 'help_skins_basics';
        if (pathname === '/help/tagset-about.html') return 'help_tagset_about';
        if (pathname === '/tag_sets') return 'tag_sets_index';
        if (pathname === '/external_works/new') return 'external_works_new';

        if (pathname === '/invite_requests' || pathname === '/invite_requests/status') return 'invite_requests_index';

        const isSearchResultsPage = document.querySelector('h2.heading')?.textContent.trim() === 'Search Results';
        if (pathname === '/works/search') {
            return isSearchResultsPage ? 'works_search_results' : 'works_search';
        }
        if (pathname === '/people/search') {
            return isSearchResultsPage ? 'people_search_results' : 'people_search';
        }
        if (pathname === '/bookmarks/search') {
            return isSearchResultsPage ? 'bookmarks_search_results' : 'bookmarks_search';
        }
        if (pathname === '/tags/search') {
            return isSearchResultsPage ? 'tags_search_results' : 'tags_search';
        }
        if (pathname === '/about') return 'about_page';

        const pathSegments = pathname.substring(1).split('/').filter(Boolean);
        if (pathname === '/users/login') return 'session_login';
        if (pathname === '/users/logout') return 'session_logout';
        if (pathname === '/') {
             return document.body.classList.contains('logged-in') ? 'dashboard' : 'front_page';
        }
        if (pathSegments.length > 0) {
            const p1 = pathSegments[0];
            const p2 = pathSegments[1];
            const p3 = pathSegments[2];
            const p4 = pathSegments[3];
            const p5 = pathSegments[4];
            switch (p1) {
                case 'admin_posts':
                    if (p2 && /^\d+$/.test(p2)) {
                        return 'admin_posts_show';
                    }
                    return 'admin_posts_index';

                case 'comments':
                    if (document.querySelector('a[href="/admin_posts"]')) {
                        return 'admin_posts_show';
                    }
                    break;

                case 'media':
                    return 'media_index';
                case 'users':
                    if (p2 && p3 === 'pseuds' && p5 === 'works') return 'users_common';
                    if (p2 && (p3 === 'blocked' || p3 === 'muted') && p4 === 'users') return 'users_block_mute_list';
                    if (p2 && p3 === 'dashboard') return 'dashboard';
                    if (p2 && p3 === 'profile') return 'profile';
                    if (p2 && p3 === 'preferences') return 'preferences';
                    if (p2 && p3 === 'edit') return 'users_settings';
                    if (p2 && p3 === 'change_username') return 'users_settings';
                    if (p2 && p3 === 'change_password') return 'users_settings';
                    if (p2 && p3 === 'change_email') return 'users_settings';
                    if (p2 && p3 === 'pseuds') {
                        if (p4 && p5 === 'edit') return 'users_settings';
                        if (p4 && !p5) return 'users_settings';
                        if (!p4) return 'users_settings';
                    }
                    if (p2 && p3 === 'works' && p4 === 'drafts') return 'users_drafts_index';
                    if (p2 && p3 === 'series') return 'users_series_index';
                    if (p2 && p3 === 'works' && p4 === 'show_multiple') return 'works_show_multiple';
                    if (p2 && p3 === 'works' && p4 === 'edit_multiple') return 'works_edit_multiple';
                    if (p2 && p3 === 'works') return 'users_works_index';
                    if (p2 && p3 === 'bookmarks') return 'users_bookmarks_index';
                    if (p2 && p3 === 'collections') return 'users_collections_index';
                    if (p2 && p3 === 'subscriptions') return 'users_subscriptions_index';
                    if (p2 && p3 === 'related_works') return 'users_related_works_index';
                    if (p2 && p3 === 'gifts') return 'users_gifts_index';
                    if (p2 && p3 === 'history') return 'users_history';
                    if (p2 && p3 === 'inbox') return 'users_inbox';
                    if (p2 && p3 === 'signups') return 'users_signups';
                    if (p2 && p3 === 'assignments') return 'users_assignments';
                    if (p2 && p3 === 'claims') return 'users_claims';
                    if (p2 && p3 === 'invitations') return 'users_invitations';
                    if (p2 && !p3) return 'profile';
                    break;
                case 'works':
                    if (p2 === 'new') return 'works_new';
                    if (p2 === 'search') return isSearchResultsPage ? 'works_search_results' : 'works_search';
                    if (p2 && /^\d+$/.test(p2)) {
                        if (p3 === 'chapters' && p4 === 'new') return 'chapters_new';
                        if (p3 === 'chapters' && p4 && /^\d+$/.test(p4) && p5 === 'edit') return 'chapters_edit';
                        if (p3 === 'edit_tags') return 'works_edit_tags';
                        if (p3 === 'edit') return 'works_edit';
                        if (!p3 || p3 === 'navigate' || (p3 === 'chapters' && p4)) return 'works_chapters_show';
                    }
                    if (!p2) return 'works_index';
                    break;
                case 'chapters':
                    if (p2 && /^\d+$/.test(p2)) {
                        return 'works_chapters_show';
                    }
                    break;
                case 'series':
                    if (p2 && /^\d+$/.test(p2)) return 'series_show';
                    if (!p2) return 'series_index';
                    break;
                case 'orphans':
                    return 'orphans_new';
                case 'collections':
                    if (p2 === 'new') {
                        return 'collections_new';
                    }
                    return 'collections_dashboard_common';
                case 'tags':
                    if (p2) {
                        if (pathSegments.slice(-1)[0] === 'works') return 'tags_works_index';
                        return 'tags_show';
                    }
                    if (!p2) return 'tags_index';
                    break;
                case 'tag_sets':
                    if (p2 === 'new') {
                        return 'tag_sets_new';
                    }
                    if (p3 === 'nominations' && p4 === 'new') {
                        return 'tag_sets_nominations_new';
                    }
                    break;
                case 'skins':
                    if (p2 === 'new') return 'skins';
                    if (p2 && /^\d+$/.test(p2) && p3 === 'edit') return 'skins_edit';
                    if (p2 && /^\d+$/.test(p2)) return 'skins_show';
                    return 'skins';
                case 'bookmarks':
                     if (p2 && /^\d+$/.test(p2) && p3 === 'new') return 'bookmarks_new_for_work';
                     if (p2 && /^\d+$/.test(p2)) return 'bookmarks_show';
                     if (!p2) return 'bookmarks_index';
                     break;
            }
        }
        if (document.body.classList.contains('dashboard')) return 'dashboard';
        if (document.querySelector('body.works.index')) return 'works_index';
        if (document.querySelector('body.works.show, body.chapters.show')) return 'works_chapters_show';
        const pathMatch = pathname.match(I18N.conf.rePagePath);
        if (pathMatch && pathMatch[1]) {
           let derivedType = pathMatch[1];
           if (pathMatch[2]) derivedType += `_${pathMatch[2]}`;
           if (I18N[CONFIG.LANG]?.[derivedType]) {
               return derivedType;
           }
        }
        return 'common';
    }

    /**
     * traverseNode 函数：遍历指定的节点，并对节点进行翻译。
     * @param {Node} rootNode - 需要遍历的节点。
     */
    function traverseNode(rootNode) {

        if (rootNode.nodeType === Node.TEXT_NODE) {
            if (rootNode.nodeValue && rootNode.nodeValue.length <= 1000) {
                if (rootNode.parentElement && rootNode.parentElement.closest(pageConfig.ignoreSelectors)) {
                    return;
                }
                transElement(rootNode, 'nodeValue');
            }
            return;
        }

        if (rootNode.nodeType === Node.ELEMENT_NODE && rootNode.closest(pageConfig.ignoreSelectors)) {
            return;
        }

        const treeWalker = document.createTreeWalker(
            rootNode,
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
            node => {
                if (node.nodeType === Node.ELEMENT_NODE && node.closest(pageConfig.ignoreSelectors)) {
                    return NodeFilter.FILTER_REJECT;
                }
                if (node.nodeType === Node.TEXT_NODE && node.parentElement && node.parentElement.closest(pageConfig.ignoreSelectors)) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        );

        const handleElement = node => {
            switch (node.tagName) {
                case 'INPUT':
                case 'TEXTAREA':
                    if (['button', 'submit', 'reset'].includes(node.type)) {
                        transElement(node.dataset, 'confirm');
                        transElement(node, 'value');
                    } else {
                        transElement(node, 'placeholder');
                        transElement(node, 'title');
                    }
                    break;
                case 'OPTGROUP':
                    transElement(node, 'label');
                    break;
                case 'BUTTON':
                    transElement(node, 'title');
                    transElement(node.dataset, 'confirm');
                    transElement(node.dataset, 'confirmText');
                    transElement(node.dataset, 'confirmCancelText');
                    transElement(node.dataset, 'disableWith');
                    break;
                case 'A':
                    transElement(node, 'title');
                    transElement(node.dataset, 'confirm');
                    break;
                case 'SPAN':
                case 'DIV':
                case 'P':
                case 'LI':
                case 'DD':
                case 'DT':
                case 'H1': case 'H2': case 'H3': case 'H4': case 'H5': case 'H6':
                    transElement(node, 'title');
                    break;
                case 'IMG':
                    transElement(node, 'alt');
                    break;
                default:
                    if (node.hasAttribute('aria-label')) transElement(node, 'ariaLabel');
                    if (node.hasAttribute('title')) transElement(node, 'title');
                    break;
            }
        };

        const handleTextNode = node => {
            if (node.nodeValue && node.nodeValue.length <= 1000) {
                transElement(node, 'nodeValue');
            }
        };

        const handlers = {
            [Node.ELEMENT_NODE]: handleElement,
            [Node.TEXT_NODE]: handleTextNode
        };

        let currentNode;
        while ((currentNode = treeWalker.nextNode())) {
            handlers[currentNode.nodeType]?.(currentNode);
        }
    }

    /**
     * transTitle 函数：翻译页面标题。
     */
    function transTitle() {
        const text = document.title;
        let translatedText = pageConfig.staticDict?.[text] || I18N[CONFIG.LANG]?.public?.static?.[text] || I18N[CONFIG.LANG]?.title?.static?.[text] || '';
        if (!translatedText) {
            const titleRegexRules = [
                ...(I18N[CONFIG.LANG]?.title?.regexp || []),
                ...(pageConfig.regexpRules || [])
            ];
            for (const rule of titleRegexRules) {
                if (!Array.isArray(rule) || rule.length !== 2) continue;
                const [pattern, replacement] = rule;
                if (pattern.test(text)) {
                    translatedText = text.replace(pattern, replacement);
                    if (translatedText !== text) break;
                }
            }
        }
        if (translatedText && translatedText !== text) {
            document.title = translatedText;
        }
    }

    /**
     * transElement 函数：翻译指定元素的文本内容或属性。
     */
    function transElement(el, field) {
        if (!el || !el[field]) return false;
        const text = el[field];
        if (typeof text !== 'string' || !text.trim()) return false;
        const translatedText = transText(text, el);
        if (translatedText && translatedText !== text) {
            try {
                el[field] = translatedText;
            } catch (e) {
            }
        }
    }

    /**
     * transText 函数：翻译文本内容。
     */
    function transText(text, el) {
        if (!text || typeof text !== 'string') return false;
        const originalText = text;
        let translatedText = text;

        const applyFlexibleDict = (targetText, dict) => {
            if (!dict) return targetText;
            const keys = Object.keys(dict);
            if (keys.length === 0) return targetText;

            const regexParts = keys.map(key => {
                const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                if (/^[\w\s]+$/.test(key)) {
                    return `\\b${escapedKey}\\b`;
                } else {
                    return escapedKey;
                }
            });
            const flexibleRegex = new RegExp(`(${regexParts.join('|')})`, 'g');

            if (el && el.nodeType === Node.TEXT_NODE && el.parentElement && el.parentElement.matches('h2.heading a.tag')) {
                const fullTagText = el.parentElement.textContent.trim();
                if (dict[fullTagText]) {
                    return targetText.replace(fullTagText, dict[fullTagText]);
                } else {
                    return targetText;
                }
            }

            return targetText.replace(flexibleRegex, (matched) => dict[matched] || matched);
        };

        translatedText = applyFlexibleDict(translatedText, pageConfig.pageFlexibleDict);
        translatedText = applyFlexibleDict(translatedText, pageConfig.globalFlexibleDict);

        const staticDict = pageConfig.staticDict || {};
        const trimmedText = translatedText.trim();
        if (staticDict[trimmedText]) {
            translatedText = translatedText.replace(trimmedText, staticDict[trimmedText]);
        }

        if (FeatureSet.enable_RegExp && pageConfig.regexpRules) {
            for (const rule of pageConfig.regexpRules) {
                if (!Array.isArray(rule) || rule.length !== 2) continue;
                const [pattern, replacement] = rule;
                if (pattern.test(translatedText)) {
                    if (typeof replacement === 'function') {
                        translatedText = translatedText.replace(pattern, replacement);
                    } else {
                        translatedText = translatedText.replace(pattern, replacement);
                    }
                }
            }
        }
        return translatedText !== originalText ? translatedText : false;
    }

    /**
     * transBySelector 函数：通过 CSS 选择器找到页面上的元素，并将其文本内容替换为预定义的翻译。
     */
    function transBySelector() {
        if (!pageConfig.tranSelectors) return;
        pageConfig.tranSelectors.forEach(rule => {
            if (!Array.isArray(rule) || rule.length !== 2) return;
            const [selector, translatedText] = rule;
            try {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element && element.textContent !== translatedText) {
                        element.textContent = translatedText;
                    }
                });
            } catch (e) {
            }
        });
    }

    /**
     * 主翻译入口函数
     * 根据当前页面类型，为不同的内容区域添加翻译按钮。
     */
	function transDesc() {
		if (!FeatureSet.enable_transDesc) {
			return;
		}

        const blurbSummaryConfig = {
            containerSelector: 'li.blurb.group',
            contentSelector: 'blockquote.userstuff.summary',
            text: '翻译简介',
            above: false,
            isLazyLoad: false
        };

        const blurbNotesConfig = {
            containerSelector: 'li.bookmark.blurb.group',
            contentSelector: 'blockquote.userstuff.notes',
            text: '翻译注释',
            above: false,
            isLazyLoad: false
        };

		const pageTranslationConfig = {
			'works_show': [
				{ selector: 'div.summary blockquote.userstuff', text: '翻译简介', above: false, isLazyLoad: false },
				{ selector: 'div.notes blockquote.userstuff', text: '翻译注释', above: false, isLazyLoad: false },
				{ selector: '#chapters .userstuff', text: '翻译正文', above: true, isLazyLoad: true },
				{ selector: 'li.comment blockquote.userstuff', text: '翻译评论', above: false, isLazyLoad: false }
			],
			'works_chapters_show': [
				{ selector: 'div.summary blockquote.userstuff', text: '翻译简介', above: false, isLazyLoad: false },
				{ selector: 'div.notes blockquote.userstuff', text: '翻译注释', above: false, isLazyLoad: false },
				{ selector: '#chapters .userstuff', text: '翻译正文', above: true, isLazyLoad: true },
				{ selector: 'li.comment blockquote.userstuff', text: '翻译评论', above: false, isLazyLoad: false }
			],
			'admin_posts_show': [
                { selector: '.admin_posts-show div[role="article"] .userstuff', text: '翻译动态', above: true, isLazyLoad: false },
				{ selector: '.comment blockquote.userstuff', text: '翻译评论', above: false, isLazyLoad: false }
			],
            'admin_posts_index': [
                { selector: '.admin_posts-index div[role="article"] .userstuff', text: '翻译动态', above: true, isLazyLoad: false }
            ],
            'works_index': [blurbSummaryConfig],
            'users_works_index': [blurbSummaryConfig],
            'tags_show': [blurbSummaryConfig],
            'tags_works_index': [blurbSummaryConfig],
            'works_search_results': [blurbSummaryConfig],
            'bookmarks_index': [blurbSummaryConfig, blurbNotesConfig],
            'users_bookmarks_index': [blurbSummaryConfig, blurbNotesConfig],
            'bookmarks_search_results': [blurbSummaryConfig, blurbNotesConfig],
            'series_show': [blurbSummaryConfig],
            'collections_dashboard_common': [blurbSummaryConfig]
		};

		const targetsForCurrentPage = pageTranslationConfig[pageConfig.currentPageType];

		if (!targetsForCurrentPage) {
			return;
		}

		targetsForCurrentPage.forEach(target => {
            if (target.containerSelector) {
                document.querySelectorAll(target.containerSelector).forEach(container => {
                    const element = container.querySelector(target.contentSelector);
                    if (element && !element.dataset.translationHandled) {
                        if (element.textContent.trim() !== '') {
                            addTranslationButton(element, target.text, target.above, target.isLazyLoad);
                        }
                        element.dataset.translationHandled = 'true';
                    }
                });
            } else {
                document.querySelectorAll(target.selector).forEach(element => {
                    if (element.dataset.translationHandled) return;
                    if (pageConfig.currentPageType === 'works_show' && target.selector === '#chapters .userstuff' && element.closest('.notes, .end.notes, .bookmark, .summary')) return;
                    if (pageConfig.currentPageType === 'works_chapters_show' && target.selector === '#chapters .userstuff' && element.closest('.notes, .end.notes, .bookmark, .summary')) return;
                    if (element.textContent.trim() !== '') {
                        addTranslationButton(element, target.text, target.above, target.isLazyLoad);
                    }
                    element.dataset.translationHandled = 'true';
                });
            }
		});
	}

    /**
     * 为指定元素添加翻译按钮
     */
    function addTranslationButton(element, originalButtonText, isAbove, isLazyLoad) {
        element.dataset.translationHandled = 'true';

        const wrapper = document.createElement('div');
        wrapper.className = 'translate-me-ao3-wrapper state-idle';

        const buttonLink = document.createElement('div');
        buttonLink.style.cssText = 'color: #1b95e0; font-size: small; cursor: pointer; display: inline-block; margin-top: 5px; margin-bottom: 5px; margin-left: 10px;';
        buttonLink.textContent = originalButtonText;
        wrapper.appendChild(buttonLink);

        isAbove ? element.before(wrapper) : element.after(wrapper);

        const controller = createTranslationController({
            containerElement: element,
            buttonWrapper: wrapper,
            originalButtonText: originalButtonText,
            isLazyLoad: isLazyLoad
        });

        buttonLink.addEventListener('click', () => controller.handleClick());
    }

    /**
     * fetchTranslatedText 函数：从特定页面的词库中获得翻译文本内容。
     * @param {string} text - 需要翻译的文本内容
     * @returns {string|boolean} 翻译后的文本内容
     */
    function fetchTranslatedText(text) {
        if (pageConfig.staticDict && pageConfig.staticDict[text] !== undefined) {
            return pageConfig.staticDict[text];
        }
        if (FeatureSet.enable_RegExp && pageConfig.regexpRules) {
            for (const rule of pageConfig.regexpRules) {
                if (!Array.isArray(rule) || rule.length !== 2) continue;
                const [pattern, replacement] = rule;
                if (pattern instanceof RegExp && pattern.test(text)) {
                    const translated = text.replace(pattern, replacement);
                    if (translated !== text) return translated;
                } else if (typeof pattern === 'string' && text.includes(pattern)) {
                     const translated = text.replace(new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
                     if (translated !== text) return translated;
                }
            }
        }
        return false;
    }

	/**
	 * 翻译标题中的标签
	 */
	function translateHeadingTags() {
		const headingTags = document.querySelectorAll('h2.heading a.tag');
		if (headingTags.length === 0) return;
		const fullDictionary = {
			...pageConfig.staticDict,
			...pageConfig.globalFlexibleDict,
			...pageConfig.pageFlexibleDict
		};
		headingTags.forEach(tagElement => {
			if (tagElement.hasAttribute('data-translated-by-custom-function')) {
				return;
			}
			const originalText = tagElement.textContent.trim();
			if (fullDictionary[originalText]) {
				tagElement.textContent = fullDictionary[originalText];
			}
			tagElement.setAttribute('data-translated-by-custom-function', 'true');
		});
	}

    /**
     * 脚本主入口检查
     */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }

})(window, document);