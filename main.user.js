// ==UserScript==
// @name         AO3 汉化插件
// @namespace    https://github.com/V-Lipset/ao3-chinese
// @description  中文化 AO3 界面，可调用 AI 实现简介、注释、评论以及全文翻译。
// @version      1.4.1-2025-08-16
// @author       V-Lipset
// @license      GPL-3.0
// @match        https://archiveofourown.org/*
// @match        https://ao3sg.hyf9588.tech/*
// @icon         https://raw.githubusercontent.com/V-Lipset/ao3-chinese/main/assets/icon.png
// @supportURL   https://github.com/V-Lipset/ao3-chinese/issues
// @downloadURL  https://raw.githubusercontent.com/V-Lipset/ao3-chinese/main/main.user.js
// @updateURL    https://cdn.jsdelivr.net/gh/V-Lipset/ao3-chinese@latest/main.user.js
// @require      https://raw.githubusercontent.com/V-Lipset/ao3-chinese/main/zh-cn.js
// @connect      raw.githubusercontent.com
// @connect      api.together.xyz
// @connect      www.codegeneration.ai
// @connect      open.bigmodel.cn
// @connect      api.deepseek.com
// @connect      generativelanguage.googleapis.com
// @connect      api.groq.com
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_notification
// ==/UserScript==

(function (window, document, undefined) {
    'use strict';
    let isFirstTranslationChunk = true;

    /****************** 全局配置区 ******************/
    const FeatureSet = {
        enable_RegExp: GM_getValue('enable_RegExp', true),
        enable_transDesc: GM_getValue('enable_transDesc', false),
    };

    // 翻译指令
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
    - **Untranslatable Content:** If an item is a separator, a meaningless symbol, or otherwise untranslatable, you MUST return the original item exactly as it is, preserving its number.

    ### Example Input:
    1. This is the <em>first</em> sentence.
    2. ---
    3. This is the third sentence.

    ### Example Output:
    1. 这是<em>第一个</em>句子。
    2. ---
    3. 这是第三个句子。
    `;

    const deepseekReasonerSystemPrompt = `You are a professional translator fluent in Simplified Chinese (简体中文). Your task is to translate a numbered list of text segments.

    ### CRITICAL OUTPUT FORMATTING:
    - Your response MUST ONLY contain the final Chinese translations.
    - The output MUST be a numbered list that exactly matches the input's numbering.
    - DO NOT include the original English text, notes, headers, or any other explanations.
    - **HTML Tag Preservation:** If an item contains HTML tags (e.g., \`<em>\`, \`<strong>\`), you MUST preserve these tags exactly as they are in the original, including their positions around the translated text.
    - If a numbered item is a separator, you MUST return it unchanged.

    ### Example Input:
    1. This is the <em>first</em> sentence.
    2. ---
    3. This is the third sentence.

    ### Example Output:
    1. 这是<em>第一个</em>句子。
    2. ---
    3. 这是第三个句子。`;

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
            temperature: 0,
        };
    };
    
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

        // 首次翻译分块
		CHUNK_SIZE: 1600,
        PARAGRAPH_LIMIT: 8,

		// 后续翻译分块
		SUBSEQUENT_CHUNK_SIZE: 2400,
        SUBSEQUENT_PARAGRAPH_LIMIT: 12,

        // 特殊模型分块
        MODEL_SPECIFIC_LIMITS: {
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

        ACTIVATION_URLS: [
            'https://www.codegeneration.ai/activate-v2'
        ],

        transEngine: GM_getValue('transEngine', 'together_ai'),
        TRANS_ENGINES: {
            together_ai: {
                name: 'Together AI',
                url_api: 'https://api.together.xyz/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                getRequestData: (paragraphs, glossary) => {
                    const model = GM_getValue('together_model', 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8');
                    return createRequestData( 
                        model,
                        sharedSystemPrompt,
                        paragraphs,
                        glossary
                    );
                },
                responseIdentifier: 'choices[0].message.content',
            },
            zhipu_ai: {
                name: 'Zhipu AI',
                url_api: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                getRequestData: (paragraphs, glossary) => createRequestData(
                    'glm-4-flash-250414',
                    sharedSystemPrompt,
                    paragraphs,
                    glossary
                ),
                responseIdentifier: 'choices[0].message.content',
            },
            deepseek_ai: {
                name: 'DeepSeek',
                url_api: 'https://api.deepseek.com/chat/completions',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                getRequestData: (paragraphs, glossary) => {
                    const model = GM_getValue('deepseek_model', 'deepseek-chat');
                    const systemPrompt = (model === 'deepseek-reasoner') 
                        ? deepseekReasonerSystemPrompt 
                        : sharedSystemPrompt;

                    return createRequestData(
                        model,
                        systemPrompt,
                        paragraphs,
                        glossary
                    );
                },
                responseIdentifier: 'choices[0].message.content',
            },
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
                            temperature: 0,
                            candidateCount: 1,
                            thinkingConfig: {
                                thinkingBudget: -1
                            }
                        }
                    };
                },
                responseIdentifier: 'candidates[0].content.parts[0].text',
            },
            groq_ai: {
                name: 'Groq AI',
                url_api: 'https://api.groq.com/openai/v1/chat/completions',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                getRequestData: (paragraphs, glossary) => {
                    const model = GM_getValue('groq_model', 'meta-llama/llama-4-maverick-17b-128e-instruct');
                    return createRequestData(
                        model,
                        sharedSystemPrompt,
                        paragraphs,
                        glossary
                    );
                },
                responseIdentifier: 'choices[0].message.content',
            },
        }
    };
	
    let pageConfig = {};

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
        const baseStatic = I18N[CONFIG.LANG]?.public?.static || {};
        const baseRegexp = I18N[CONFIG.LANG]?.public?.regexp || [];
        const baseSelector = I18N[CONFIG.LANG]?.public?.selector || [];
        const baseInnerHTMLRegexp = I18N[CONFIG.LANG]?.public?.innerHTML_regexp || [];
        const globalFlexible = (pageType === 'admin_posts_show') ? {} : (I18N[CONFIG.LANG]?.flexible || {});

        const usersCommonStatic = (pageType.startsWith('users_') || pageType === 'profile' || pageType === 'dashboard')
            ? I18N[CONFIG.LANG]?.users_common?.static || {}
            : {};

        const pageStatic = I18N[CONFIG.LANG]?.[pageType]?.static || {};
        const pageRegexp = I18N[CONFIG.LANG]?.[pageType]?.regexp || [];
        const pageSelector = I18N[CONFIG.LANG]?.[pageType]?.selector || [];
        const pageInnerHTMLRegexp = I18N[CONFIG.LANG]?.[pageType]?.innerHTML_regexp || [];
        let pageFlexible = (pageType === 'admin_posts_show') ? {} : (I18N[CONFIG.LANG]?.[pageType]?.flexible || {});

        const parentPageMap = {
            'works_edit': 'works_new',
            'works_edit_tags': 'works_new',
            'chapters_new': 'works_new',
            'chapters_edit': 'chapters_new'
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
     * detectPageType 函数：检测当前页面类型，基于URL。
     * @returns {string|boolean} 页面的类型
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
        const { pathname, search } = window.location;
        // 忽略 /first_login_help 页面
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
        if (pathname === '/works') return 'works_new';
        
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
                    if (!p2 || (p2 && /^\d+$/.test(p2))) {
                        return 'admin_posts_show';
                    }
                    return 'common';

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
                    if (pathname === '/works/search') return 'works_search';
                    if (p2 === 'new' && search.includes('import=true')) return 'works_import';
                    if (p2 && /^\d+$/.test(p2)) {
                        if (p3 === 'chapters' && p4 === 'new') {
                            return 'chapters_new';
                        }
                        if (p3 === 'chapters' && p4 && /^\d+$/.test(p4) && p5 === 'edit') {
                            return 'chapters_edit';
                        }
                        if (p3 === 'edit_tags') {
                        return 'works_edit_tags';
                        }
                        const heading = document.querySelector('h2.heading');
                            if (heading && heading.textContent.trim() === 'Edit Work') {
                                return 'works_edit';
                            }
                    if ((p3 === 'chapters' && p4) || (!p3 || p3 === 'navigate')) {
                        return 'works_chapters_show';
                    }
                        if (p3 === 'edit') return 'works_edit';
                        if (!p3 || p3 === 'navigate') return 'works_chapters_show';
                        if (p2 === 'new') return 'works_new';
                    }
                    if (p2 === 'new') return 'works_new';
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
     * sleepms 函数：延时。
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 主翻译入口函数
     * 根据当前页面类型，为不同的内容区域添加翻译按钮。
     */
    function transDesc() {

        if (!FeatureSet.enable_transDesc) {
            return;
        }

        const pageTranslationConfig = {
            'works_show': [
                { selector: 'div.summary blockquote.userstuff', text: '翻译简介', above: false, clearable: true },
                { selector: 'div.notes blockquote.userstuff', text: '翻译注释', above: false, clearable: true },
                { selector: '#chapters .userstuff', text: '翻译正文', above: true, clearable: false },
                { selector: 'li.comment blockquote.userstuff', text: '翻译评论', above: false, clearable: true }
            ],
            'works_chapters_show': [
                { selector: 'div.summary blockquote.userstuff', text: '翻译简介', above: false, clearable: true },
                { selector: 'div.notes blockquote.userstuff', text: '翻译注释', above: false, clearable: true },
                { selector: '#chapters .userstuff', text: '翻译正文', above: true, clearable: false },
                { selector: 'li.comment blockquote.userstuff', text: '翻译评论', above: false, clearable: true }
            ],
            'admin_posts_show': [
                { selector: '.comment blockquote.userstuff', text: '翻译评论', above: false, clearable: true }
            ]
        };

        const targetsForCurrentPage = pageTranslationConfig[pageConfig.currentPageType];

        if (!targetsForCurrentPage) {
            return;
        }

        targetsForCurrentPage.forEach(target => {
            document.querySelectorAll(target.selector).forEach(element => {
                if (element.dataset.translationHandled) {
                    return;
                }
                if (pageConfig.currentPageType === 'works_show' && target.selector === '#chapters .userstuff' && element.closest('.notes, .end.notes, .bookmark, .summary')) {
                    return;
                }
                if (pageConfig.currentPageType === 'works_chapters_show' && target.selector === '#chapters .userstuff' && element.closest('.notes, .end.notes, .bookmark, .summary')) {
                    return;
                }

                addTranslationButton(element, target.text, target.above, target.clearable);
            });
        });
    }

    /**
     * 翻译按钮添加函数
     * @param {HTMLElement} element - 目标元素
     * @param {string} originalButtonText - 按钮初始文本
     * @param {boolean} isAbove - 按钮是否在元素上方
     * @param {boolean} canClear - 是否支持“清除”功能
     */
    function addTranslationButton(element, originalButtonText, isAbove, canClear) {
        element.dataset.translationHandled = 'true';

        const wrapper = document.createElement('div');
        wrapper.className = 'translate-me-ao3-wrapper';

        const buttonLink = document.createElement('div');
        buttonLink.style.cssText = 'color: #1b95e0; font-size: small; cursor: pointer; display: inline-block; margin-top: 5px; margin-bottom: 5px; margin-left: 10px;';
        buttonLink.textContent = originalButtonText;
        wrapper.appendChild(buttonLink);

        isAbove ? element.before(wrapper) : element.after(wrapper);

        const handleClick = () => {
            if (wrapper.dataset.state === 'translated') {
                const translationNodes = element.querySelectorAll('.translated-by-ao3-script, .translated-by-ao3-script-error');
                translationNodes.forEach(node => node.remove());

                element.querySelectorAll('[data-translation-state="translated"]').forEach(originalUnit => {
                    delete originalUnit.dataset.translationState;
                });

                buttonLink.textContent = originalButtonText;
                delete wrapper.dataset.state;
                return;
            }

            if (!canClear) {
                buttonLink.removeEventListener('click', handleClick);
                buttonLink.textContent = '翻译已启用...';
                buttonLink.style.cursor = 'default';
                buttonLink.style.color = '#777';
                startTranslationEngine(element, null);
                return;
            }
            
            buttonLink.removeEventListener('click', handleClick);
            buttonLink.textContent = '翻译中…';

            startTranslationEngine(element, () => {
                buttonLink.textContent = '已翻译';
                wrapper.dataset.state = 'translated';
                buttonLink.addEventListener('click', handleClick);
            });
        };

        buttonLink.addEventListener('click', handleClick);
    }

    /**
     * 主分发函数：根据是否有回调，决定是为“区块”还是为“正文”启动翻译。
     */
    function startTranslationEngine(containerElement, onComplete) {
        if (onComplete) {
            runTranslationEngineForBlock(containerElement, onComplete);
        }
        else {
            runTranslationEngineWithObserver(containerElement);
        }
    }

    /**
     * 翻译函数：遵循四级优先级
     */
    async function translateParagraphs(paragraphs, { retryCount = 0, maxRetries = 3 } = {}) {
        if (!paragraphs || paragraphs.length === 0) {
            return new Map();
        }

        const indexedParagraphs = paragraphs.map((p, index) => ({
            original: p,
            index: index,
            isSeparator: p.tagName === 'HR' || /^\s*[-—*~<>#.=_\s]{3,}\s*$/.test(p.textContent),
            content: p.innerHTML
        }));

        const contentToTranslate = indexedParagraphs.filter(p => !p.isSeparator);
        const paragraphsForAI = contentToTranslate.map(p => p.original);

        if (paragraphsForAI.length === 0) {
            const results = new Map();
            indexedParagraphs.forEach(p => {
                results.set(p.original, { status: 'success', content: p.content });
            });
            return results;
        }

        const localForbidden = GM_getValue(LOCAL_FORBIDDEN_TERMS_KEY, []);
        localForbidden.sort((a, b) => b.length - a.length);
        const placeholders = new Map();
        let placeholderIndex = 0;
        
        const paragraphsWithPlaceholders = paragraphsForAI.map(p => {
            const clone = p.cloneNode(true);
            if (localForbidden.length > 0) {
                const treeWalker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
                let currentNode;
                while (currentNode = treeWalker.nextNode()) {
                    let text = currentNode.nodeValue;
                    for (const term of localForbidden) {
                        const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        const regex = new RegExp(`\\b(${escapedTerm}(?:'s|s|es)?)\\b`, 'gi');
                        text = text.replace(regex, (matched) => {
                            if (matched.toLowerCase().startsWith(term.toLowerCase())) {
                                const placeholder = `__FT_${placeholderIndex}__`;
                                placeholders.set(placeholder, matched);
                                placeholderIndex++;
                                return placeholder;
                            }
                            return matched;
                        });
                    }
                    currentNode.nodeValue = text;
                }
            }
            return clone;
        });

        try {
            const processedParagraphs = await getGlossaryProcessedParagraphs(paragraphsWithPlaceholders);
            const combinedTranslation = await requestRemoteTranslation(processedParagraphs);

            let restoredTranslation = combinedTranslation;
            if (placeholders.size > 0) {
                for (const [placeholder, originalTerm] of placeholders) {
                    const placeholderRegex = new RegExp(placeholder, 'g');
                    let replacement = originalTerm;
                    if (originalTerm.toLowerCase().endsWith("'s")) {
                        const baseTerm = originalTerm.slice(0, -2);
                        replacement = `${baseTerm}的`;
                    }
                    restoredTranslation = restoredTranslation.replace(placeholderRegex, replacement);
                }
            }

            let translatedParts = [];
            const regex = /\d+\.\s*([\s\S]*?)(?=\n\d+\.|$)/g;
            let match;
            while ((match = regex.exec(restoredTranslation)) !== null) {
                translatedParts.push(match[1].trim());
            }

            if (translatedParts.length !== paragraphsForAI.length && restoredTranslation.includes('\n')) {
                const potentialParts = restoredTranslation.split('\n').filter(p => p.trim().length > 0);
                if (potentialParts.length === paragraphsForAI.length) {
                    translatedParts = potentialParts.map(p => p.replace(/^\d+\.\s*/, '').trim());
                }
            }

            if (translatedParts.length !== paragraphsForAI.length) {
                throw new Error('AI 响应格式不一致，分段数量不匹配');
            }

            contentToTranslate.forEach((p, i) => {
                p.translatedContent = AdvancedTranslationCleaner.clean(translatedParts[i] || p.content);
            });

            const finalResults = new Map();
            indexedParagraphs.forEach(p => {
                if (p.isSeparator) {
                    finalResults.set(p.original, { status: 'success', content: p.content });
                } else {
                    finalResults.set(p.original, { status: 'success', content: p.translatedContent });
                }
            });
            
            return finalResults;

        } catch (e) {
            console.error(`翻译失败 (尝试 ${retryCount + 1}/${maxRetries + 1}):`, e.message);

            if (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                return await translateParagraphs(paragraphs, { retryCount: retryCount + 1, maxRetries });
            }
            
            if (e.message.includes('分段数量不匹配')) {
                console.warn("批量翻译失败，自动切换到逐段翻译模式...");
                const fallbackResults = new Map();
                for (const p of paragraphs) {
                    const singleResultMap = await translateParagraphs([p], { maxRetries: 0 });
                    const singleResult = singleResultMap.get(p);
                    
                    if (singleResult && singleResult.status === 'success') {
                        fallbackResults.set(p, singleResult);
                    } else {
                        const errorMessage = (singleResult && singleResult.content) ? singleResult.content : '未知错误';
                        console.error(`逐段翻译失败: ${errorMessage}`);
                        fallbackResults.set(p, { status: 'error', content: errorMessage });
                    }
                }
                return fallbackResults;
            } else {
                console.error("所有重试均失败，翻译终止。");
                const results = new Map();
                const finalErrorMessage = `翻译失败：${e.message}`;
                paragraphs.forEach(p => {
                    results.set(p, { status: 'error', content: finalErrorMessage });
                });
                return results;
            }
        }
    }
    
    /**
     * 翻译引擎（可清除译文）
     * @param {HTMLElement} containerElement - 容器元素
     * @param {function} onComplete - 全部翻译完成后的回调
     */
    async function runTranslationEngineForBlock(containerElement, onComplete) {
        const translatableSelectors = 'p, blockquote, li, h1, h2, h3:not(.landmark), h4, h5, h6';
        let allPotentialUnits = Array.from(containerElement.querySelectorAll(translatableSelectors));

        if (allPotentialUnits.length === 0 && containerElement.textContent.trim()) {
            allPotentialUnits = [containerElement];
        }

        const skippableHeaders = ['Summary', 'Notes', 'Work Text'];
        const candidateUnits = allPotentialUnits.filter(p => !skippableHeaders.includes(p.textContent.trim()));

        const units = [];
        for (const unit of candidateUnits) {
            if (!unit.querySelector(translatableSelectors)) {
                units.push(unit);
            }
        }

        if (units.length === 0) {
            if (onComplete) onComplete();
            return;
        }

        units.forEach(unit => unit.dataset.translationState = 'translating');

        const translationResults = await translateParagraphs(units);

        units.forEach(unit => {
            const result = translationResults.get(unit);
            if (result) {
                const transNode = document.createElement('div');
                const tagName = unit.tagName.toLowerCase();
                if (result.status === 'success') {
                    transNode.className = 'translated-by-ao3-script';
                    transNode.innerHTML = `<${tagName}>${result.content}</${tagName}>`;
                    unit.dataset.translationState = 'translated';
                } else {
                    transNode.className = 'translated-by-ao3-script-error';
                    transNode.innerHTML = `<${tagName}>${result.content}</${tagName}>`;
                    unit.dataset.translationState = 'error';
                }
                transNode.style.cssText = 'margin-top: 0.25em; margin-bottom: 1em;';
                unit.after(transNode);
            } else {
                unit.dataset.translationState = 'error';
            }
        });

        if (onComplete) onComplete();
    }

    /**
     * 辅助函数：获取当前选择的 AI 服务的具体模型ID
     */
    function getCurrentModelId() {
        const engine = GM_getValue('transEngine', 'together_ai');
        switch (engine) {
            case 'google_ai':
                return GM_getValue('google_ai_model', 'gemini-2.5-pro');
            case 'deepseek_ai':
                return GM_getValue('deepseek_model', 'deepseek-chat');
            case 'together_ai':
                return GM_getValue('together_model', 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8');
            case 'groq_ai':
                return GM_getValue('groq_model', 'meta-llama/llama-4-maverick-17b-128e-instruct');
            default:
                return '';
        }
    }

    /**
     * 翻译引擎（懒加载模式）
     * @param {HTMLElement} containerElement - 容器元素
     */
    function runTranslationEngineWithObserver(containerElement) {

        const elementState = new WeakMap();

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
                
                const newElements = fragmentsHTML
                    .map(fragment => fragment.trim())
                    .filter(fragment => fragment)
                    .map(fragment => {
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
        let isProcessing = false;
        const translationQueue = new Set();
        let scheduleTimeout = null;
        let flushTimeout = null;

        const isInViewport = (el) => {
            const rect = el.getBoundingClientRect();
            return ( rect.top < window.innerHeight && rect.bottom >= 0 );
        };

        const processQueue = async (observer, forceFlush = false) => {
            if (isProcessing || translationQueue.size === 0) return;
            
            clearTimeout(flushTimeout);

            const allQueuedUnits = [...translationQueue];
            if (allQueuedUnits.length === 0) return;

            const visibleInQueue = allQueuedUnits.filter(isInViewport);
            const offscreenInQueue = allQueuedUnits.filter(p => !visibleInQueue.includes(p));
            const prioritizedUnits = [...visibleInQueue, ...offscreenInQueue];

            const runType = isFirstTranslationChunk ? 'first' : 'subsequent';

            const modelId = getCurrentModelId();

            let paragraphLimit = isFirstTranslationChunk ? CONFIG.PARAGRAPH_LIMIT : CONFIG.SUBSEQUENT_PARAGRAPH_LIMIT;
            let chunkSize = isFirstTranslationChunk ? CONFIG.CHUNK_SIZE : CONFIG.SUBSEQUENT_CHUNK_SIZE;

            const modelLimits = getNestedProperty(CONFIG.MODEL_SPECIFIC_LIMITS, `${modelId}.${runType}`);
            if (modelLimits) {
                paragraphLimit = modelLimits.PARAGRAPH_LIMIT;
                chunkSize = modelLimits.CHUNK_SIZE;
            }

            let currentChars = 0;
            let chunkToSend = [];

            for (const unit of prioritizedUnits) {
                const isSeparator = unit.tagName === 'HR' || /^\s*[-—*~<>#.=_\s]{3,}\s*$/.test(unit.textContent);
                if (isSeparator) {
                    if (chunkToSend.length > 0) break;
                    chunkToSend.push(unit);
                    break;
                }
                chunkToSend.push(unit);
                currentChars += unit.textContent.length;
                if (chunkToSend.length >= paragraphLimit || currentChars >= chunkSize) {
                    break;
                }
            }

            const isChunkBigEnough = chunkToSend.length >= paragraphLimit || currentChars >= chunkSize;
            const isChunkSeparator = chunkToSend.length > 0 && (chunkToSend[0].tagName === 'HR' || /^\s*[-—*~<>#.=_\s]{3,}\s*$/.test(chunkToSend[0].textContent));

            if (!isChunkBigEnough && !isChunkSeparator && !forceFlush) {
                if (translationQueue.size > 0) {
                    flushTimeout = setTimeout(() => scheduleProcessing(observer, true), 2000);
                }
                return;
            }
            
            if (chunkToSend.length === 0) return;

            isProcessing = true;
            if (isFirstTranslationChunk) isFirstTranslationChunk = false;
            chunkToSend.forEach(p => translationQueue.delete(p));

            const paragraphsToTranslate = chunkToSend.filter(p => p.tagName !== 'HR' && p.textContent.trim().length > 0);
            const translationResults = paragraphsToTranslate.length > 0 ? await translateParagraphs(paragraphsToTranslate) : new Map();

            for (const p of chunkToSend) {
                if (p.tagName === 'HR' || p.textContent.trim().length === 0 || /^\s*[-—*~<>#.=_\s]{3,}\s*$/.test(p.textContent)) {
                    elementState.set(p, { ...elementState.get(p), status: 'translated' });
                    p.dataset.translationState = 'translated';
                    if (observer) observer.unobserve(p);
                    continue;
                }
                const result = translationResults.get(p);
                if (result) {
                    const transNode = document.createElement('div');
                    if (result.status === 'success') {
                        transNode.className = 'translated-by-ao3-script';
                        transNode.innerHTML = `<${p.tagName.toLowerCase()}>${result.content}</${p.tagName.toLowerCase()}>`;
                        const currentMode = GM_getValue('translation_display_mode', 'bilingual');
                        if (currentMode === 'translation_only') p.style.display = 'none';
                        elementState.set(p, { ...elementState.get(p), status: 'translated' });
                        p.dataset.translationState = 'translated';
                        if (observer) observer.unobserve(p);
                    } else {
                        transNode.className = 'translated-by-ao3-script-error';
                        transNode.innerHTML = `<${p.tagName.toLowerCase()}>翻译失败：${result.content.replace('翻译失败：', '')}</${p.tagName.toLowerCase()}>`;
                        elementState.delete(p);
                    }
                    transNode.style.cssText = 'margin-top: 0.25em; margin-bottom: 1em;';
                    p.after(transNode);
                } else {
                    elementState.delete(p);
                }
            }

            isProcessing = false;

            if (translationQueue.size > 0) {
                scheduleProcessing(observer, false);
            }
        };

        const scheduleProcessing = (observer, force = false) => {
            clearTimeout(scheduleTimeout);
            scheduleTimeout = setTimeout(() => processQueue(observer, force), 300);
        };
        
        const observer = new IntersectionObserver((entries, obs) => {
            let addedToQueue = false;
            entries.forEach(entry => {
                const state = elementState.get(entry.target);
                if (entry.isIntersecting && (!state || !state.status)) {
                    elementState.set(entry.target, { ...state, status: 'queued' });
                    translationQueue.add(entry.target);
                    addedToQueue = true;
                }
            });

            if (addedToQueue) {
                scheduleProcessing(obs, false);
            }
        }, { rootMargin: '400px 0px 1000px 0px' });

        allUnits.forEach(unit => {
            if (!elementState.get(unit)?.status) {
                observer.observe(unit);
            }
        });
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
     * 获取并缓存 Together AI 的 API Key
     * @param {boolean} forceRefetch - 如果为 true, 则强制重新获取 Key
     */
    async function getTogetherApiKey(forceRefetch = false) {
        const CACHE_KEY = 'together_api_key_free_cache';
        
        if (!forceRefetch) {
            const cachedKey = GM_getValue(CACHE_KEY, null);
            if (cachedKey) {
                return cachedKey;
            }
        }

        console.log('Fetching new Together AI API Key...');

        for (const url of CONFIG.ACTIVATION_URLS) {
            try {
                const newKey = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: url,
                        headers: { 'Accept': 'application/json' },
                        onload: (response) => {
                            try {
                                const data = JSON.parse(response.responseText);
                                const key = data?.openAIParams?.apiKey || data?.apiKey;
                                if (key) {
                                    resolve(key);
                                } else {
                                    reject(new Error(`No API Key found in response from ${url}`));
                                }
                            } catch (e) {
                                reject(new Error(`Failed to parse response from ${url}: ${e.message}`));
                            }
                        },
                        onerror: () => reject(new Error(`Network error at ${url}`)),
                        ontimeout: () => reject(new Error(`Timeout at ${url}`))
                    });
                });

                if (newKey) {
                    GM_setValue(CACHE_KEY, newKey);
                    console.log('Successfully fetched and cached new API Key.');
                    return newKey;
                }
            } catch (error) {
                console.warn(error.message);
            }
        }

        throw new Error('Failed to retrieve Together AI API Key from all available sources.');
    }

    /**
     * 处理 Google AI 的 API 请求，包含 Key 轮询机制
     */
    async function _handleGoogleAiRequest(engineConfig, paragraphs) {
        const keys = GM_getValue('google_ai_keys_array', []);
        if (keys.length === 0) {
            throw new Error('请先在菜单中设置至少一个 Google AI API Key');
        }

        let keyIndex = GM_getValue('google_ai_key_index', 0) % keys.length;
        const modelId = getCurrentModelId();

        for (let i = 0; i < keys.length; i++) {
            const currentKey = keys[keyIndex];
            console.log(`正在尝试使用 Google AI API Key #${keyIndex + 1}...`);
            
            const final_url = engineConfig.url_api.replace('{model}', modelId) + `?key=${currentKey}`;
            const requestData = engineConfig.getRequestData(paragraphs);

            try {
                const result = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: engineConfig.method, url: final_url, headers: engineConfig.headers,
                        data: JSON.stringify(requestData), responseType: 'json', timeout: 45000,
                        onload: (res) => {
                            let responseData = res.response;
                            if (typeof responseData === 'string') try { responseData = JSON.parse(responseData); } catch(e) {}

                            const candidate = getNestedProperty(responseData, 'candidates[0]');
                            if (res.status !== 200 || !candidate) {
                                console.debug("Google AI 异常响应详情：", { requestPayload: requestData, response: responseData, status: res.status });
                            }

                            if (res.status === 200) {
                                if (!candidate) return reject({ type: 'empty_response', message: `Key #${keyIndex + 1} 失败：API 返回了无效的内容` });
                                const finishReason = candidate.finishReason;
                                if (['SAFETY', 'RECITATION', 'PROHIBITED_CONTENT'].includes(finishReason)) return reject({ type: 'content_error', message: `因含有敏感内容，请求被 Google AI 安全策略阻止` });
                                const content = getNestedProperty(candidate, 'content.parts[0].text');
                                if (!content) return reject({ type: 'empty_response', message: `Key #${keyIndex + 1} 失败：API 返回了空内容 (FinishReason: ${finishReason})` });
                                return resolve(responseData);
                            }

                            const errorMessage = getNestedProperty(responseData, 'error.message') || res.statusText || '未知错误';
                            if (res.status === 400 && errorMessage.toLowerCase().includes('api_key_invalid')) return reject({ type: 'key_invalid', message: `Key #${keyIndex + 1} 无效` });
                            if (res.status === 429) return reject({ type: 'rate_limit', message: `Key #${keyIndex + 1} 遇到错误（代码：429）：${errorMessage}` });
                            if (res.status === 503) return reject({ type: 'server_overloaded', message: `Key #${keyIndex + 1} 遇到错误（代码：503）：${errorMessage}` });
                            return reject({ type: 'api_error', message: `Key #${keyIndex + 1} 遇到错误（代码：${res.status}）：${errorMessage}` });
                        },
                        onerror: () => reject({ type: 'network', message: `Key #${keyIndex + 1} 网络错误` }),
                        ontimeout: () => reject({ type: 'network', message: `Key #${keyIndex + 1} 请求超时` })
                    });
                });
                
                const translatedText = getNestedProperty(result, engineConfig.responseIdentifier);
                GM_setValue('google_ai_key_index', (keyIndex + 1) % keys.length);
                return translatedText;

            } catch (error) {
                console.warn(error.message);
                if (error.type === 'key_invalid' || error.type === 'quota_exceeded') {
                    keyIndex = (keyIndex + 1) % keys.length;
                    GM_setValue('google_ai_key_index', keyIndex);
                    if (i === keys.length - 1) {
                        throw new Error('所有 Google AI API Key 均已失效或用尽额度');
                    }
                } else {
                    throw error;
                }
            }
        }
    }

	/**
     * 获取当前有效翻译引擎的名称
     */
	function getValidEngineName() {
		const storedEngine = GM_getValue('transEngine');
		const defaultEngine = 'together_ai';
		if (storedEngine && CONFIG.TRANS_ENGINES[storedEngine]) {
			return storedEngine;
		}
		return defaultEngine;
	}

    /**
     * 处理标准 Bearer Token 认证的 API 请求
     */
	async function _handleStandardApiRequest(engineConfig, paragraphs, engineName) {
		const { name, url_api, method, responseIdentifier, getRequestData } = engineConfig;

		let headers = { ...engineConfig.headers };
		if (engineName === 'together_ai') {
			headers['Authorization'] = `Bearer ${await getTogetherApiKey()}`;
		} else {
			const apiKey = GM_getValue(`${engineName.split('_')[0]}_api_key`);
			if (!apiKey) throw new Error(`请先在菜单中设置 ${name} API Key`);
			headers['Authorization'] = `Bearer ${apiKey}`;
		}

		const requestData = getRequestData(paragraphs);
		
		const res = await new Promise((resolve, reject) => {
			GM_xmlhttpRequest({
				method, url: url_api, headers, data: JSON.stringify(requestData),
				responseType: 'json', timeout: 45000,
				onload: resolve,
				onerror: () => reject(new Error('网络请求错误')),
				ontimeout: () => reject(new Error('请求超时'))
			});
		});
		
		if (res.status !== 200) {
			let errorMessage = res.statusText;
			let responseData = res.response;
			if (typeof responseData === 'string') try { responseData = JSON.parse(responseData); } catch (e) {}
			
			if (engineName === 'zhipu_ai' && getNestedProperty(responseData, 'error.code') === '1301') {
				throw new Error('因含有敏感内容，请求被 Zhipu AI 安全策略阻止');
			}
			
			if (responseData && typeof responseData === 'object' && responseData.error) {
				errorMessage = responseData.error.message || JSON.stringify(responseData.error);
			}

			console.debug(`${name} 异常响应详情：`, { requestPayload: requestData, response: res.response, status: res.status });
			if (res.status === 503 || res.status === 429 || res.status >= 500) {
				const error = new Error(`（代码：${res.status}）：${errorMessage}`);
				error.type = 'server_overloaded';
				throw error;
			}
			throw new Error(`（代码：${res.status}）：${errorMessage}`);
		}
		
		return getNestedProperty(res.response, responseIdentifier);
	}

    /**
     * 远程翻译请求函数
     */
	async function requestRemoteTranslation(paragraphs, { retryCount = 0, maxRetries = 5 } = {}) {
		const engineName = getValidEngineName();
		const engineConfig = CONFIG.TRANS_ENGINES[engineName];
		if (!engineConfig) {
			throw new Error(`服务 ${engineName} 未配置`);
		}

		try {
			let translatedText;
			if (engineName === 'google_ai') {
				translatedText = await _handleGoogleAiRequest(engineConfig, paragraphs);
			} else {
				translatedText = await _handleStandardApiRequest(engineConfig, paragraphs, engineName);
			}
			
			if (typeof translatedText !== 'string' || !translatedText.trim()) {
				throw new Error('API 未返回有效文本');
			}
			
			return translatedText;

		} catch (error) {
			const isRetriable = ['server_overloaded', 'rate_limit', 'network', 'timeout'].includes(error.type) ||
								error.message.includes('超时') || 
								error.message.includes('网络');

			if (retryCount < maxRetries && isRetriable) {
				const delay = Math.pow(2, retryCount) * 1500 + Math.random() * 1000;
				console.warn(`请求遇到可重试错误：${error.message}。将在 ${Math.round(delay/1000)} 秒后重试（第 ${retryCount + 1} 次）...`);
				await sleep(delay);
				return await requestRemoteTranslation(paragraphs, { retryCount: retryCount + 1, maxRetries });
			}
			throw error;
		}
	}

    /**
     * 设置用户自己的 ChatGLM API Key
     */
    function setupZhipuAIKey() {
        const currentKey = GM_getValue('zhipu_api_key', '');
        const newKey = prompt('请输入您的 Zhipu AI API Key：', currentKey);
        if (newKey !== null) {
            GM_setValue('zhipu_api_key', newKey.trim());
            notifyAndLog(newKey.trim() ? 'Zhipu AI API Key 已保存！' : 'Zhipu AI API Key 已清除！');
        }
    }

    /**
     * 设置用户自己的 DeepSeek API Key
     */
    function setupDeepSeekKey() {
        const currentKey = GM_getValue('deepseek_api_key', '');
        const newKey = prompt('请输入您的 DeepSeek API Key：', currentKey);
        if (newKey !== null) {
            GM_setValue('deepseek_api_key', newKey.trim());
            notifyAndLog(newKey.trim() ? 'DeepSeek API Key 已保存！' : 'DeepSeek API Key 已清除！');
        }
    }

    /**
     * 设置用户自己的 Google AI API Key
     */
    function setupGoogleAiKeys() {
        const storedKeys = GM_getValue('google_ai_keys_array', []);
        const currentKeysString = storedKeys.join(',\n');
        const newKeysString = prompt(
            '请输入一个或多个 Google AI API Key，用英文逗号分隔。脚本将自动轮询这些 API Key 以提高额度。',
            currentKeysString
        );
        if (newKeysString !== null) {
            const newKeysArray = newKeysString.split(',')
                .map(key => key.trim())
                .filter(key => key.length > 0);
            GM_setValue('google_ai_keys_array', newKeysArray);
            if (newKeysArray.length > 0) {
                notifyAndLog(`已保存 ${newKeysArray.length} 个 Google AI API Key！`);
                GM_setValue('google_ai_key_index', 0);
            } else {
                notifyAndLog('Google AI API Key 已全部清除。');
            }
        }
    }

    /**
     * 设置用户自己的 Groq AI API Key
     */
    function setupGroqAIKey() {
        const currentKey = GM_getValue('groq_api_key', '');
        const newKey = prompt('请输入您的 Groq AI API Key：', currentKey);
        if (newKey !== null) {
            GM_setValue('groq_api_key', newKey.trim());
            notifyAndLog(newKey.trim() ? 'Groq AI API Key 已保存！' : 'Groq AI API Key 已清除！');
        }
    }

    const LOCAL_GLOSSARY_KEY = 'ao3_local_glossary'; // 用于存储用户手动创建的术语
    const LOCAL_FORBIDDEN_TERMS_KEY = 'ao3_local_forbidden_terms'; // 用于存储用户手动创建的禁翻词条
    const IMPORTED_GLOSSARY_KEY = 'ao3_imported_glossary'; // 用于存储所有在线导入的术语
    const GLOSSARY_METADATA_KEY = 'ao3_glossary_metadata'; // 用于储存导入的术语表的信息

    /**
     * 管理用户手动设置的本地术语表
     */
    function manageGlossary() {
        const currentGlossary = GM_getValue(LOCAL_GLOSSARY_KEY, {});
        
        const glossaryForDisplay = Object.entries(currentGlossary)
            .map(([key, value]) => `${key.includes(' ') ? `${key} = ${value}` : `${key}：${value}`}`)
            .join('，');

        const userInput = prompt(
            '请按 “原文：译文” 格式编辑您的本地术语表，词条间用逗号分隔。\n' +
            '本地词条将优先于所有在线术语表规则，且默认区分大小写。\n\n' +
            '示例\n' +
            'Wakaba：若叶，Mutsumi：睦，Tsukinomori Girls\' Academy：月之森女子学园',
            glossaryForDisplay
        );

        if (userInput === null || userInput.trim() === glossaryForDisplay.trim()) {
            notifyAndLog('本地术语表未更改。');
            return;
        }

        const newGlossary = {};
        const invalidEntries = [];

        if (userInput.trim() === '') {
            GM_setValue(LOCAL_GLOSSARY_KEY, {});
            notifyAndLog('本地翻译术语表已清空。');
            return;
        }

        const entries = userInput.split(/[，,]/);
        for (const entry of entries) {
            const trimmedEntry = entry.trim();
            if (trimmedEntry === '') continue;
            
            let key = '', value = '';
            const multiPartParts = trimmedEntry.split('=', 2);
            if (multiPartParts.length === 2) {
                key = multiPartParts[0].trim();
                value = multiPartParts[1].trim();
            } else {
                const singleParts = trimmedEntry.split(/[:：]/, 2);
                if (singleParts.length === 2) {
                    key = singleParts[0].trim();
                    value = singleParts[1].trim();
                }
            }

            if (key && value) {
                newGlossary[key] = value;
            } else {
                invalidEntries.push(trimmedEntry);
            }
        }

        if (invalidEntries.length > 0) {
            alert(
                '检测到以下词条格式不正确，已被忽略：\n\n' +
                invalidEntries.join('\n') +
                '\n\n请确保每个词条都使用中文冒号“：”或英文冒号“:”分隔，多词术语建议使用等号“=”分隔。'
            );
        }

        GM_setValue(LOCAL_GLOSSARY_KEY, newGlossary);
        notifyAndLog('本地翻译术语表已成功更新！');
    }

    /**
     * 管理用户手动设置的本地禁翻术语表
     */
    function manageForbiddenTerms() {
        const currentTerms = GM_getValue(LOCAL_FORBIDDEN_TERMS_KEY, []);
        const termsForDisplay = currentTerms.join('，');
        const userInput = prompt(
            '请输入您不希望被 AI 翻译的内容，词条间用逗号分隔。\n这些词条在翻译时会保持原文。\n\n示例\nEDGE, HUSH',
            termsForDisplay
        );
        if (userInput === null || userInput.trim() === termsForDisplay.trim()) {
            notifyAndLog('禁翻术语表未更改。');
            return;
        }
        if (userInput.trim() === '') {
            GM_setValue(LOCAL_FORBIDDEN_TERMS_KEY, []);
            notifyAndLog('禁翻术语表已清空。');
            return;
        }
        const newTerms = userInput.split(/[，,]/).map(term => term.trim()).filter(term => term);
        GM_setValue(LOCAL_FORBIDDEN_TERMS_KEY, newTerms);
        notifyAndLog('禁翻术语表已成功更新！');
    }

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
            forbiddenTerms: []
        };
        const lines = text.split('\n');

        const sectionHeaders = {
            TERMS: ['terms', '词条'],
            GENERAL_TERMS: ['general terms', '通用词条'],
            FORBIDDEN_TERMS: ['forbidden terms', '禁翻词条']
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
            if (inMetadata && !isHeader) {
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
            
            const multiPartParts = line.split('=', 2);
            if (multiPartParts.length === 2) {
                const key = multiPartParts[0].trim();
                const value = multiPartParts[1].trim().replace(/[,，]$/, '');
                if (key && value) multiPartTarget[key] = value;
                return;
            }
            
            const singleParts = line.split(/[:：]/, 2);
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
                switch (section.type) {
                    case 'TERMS':
                        processLine(line, result.terms, result.multiPartTerms);
                        break;
                    case 'GENERAL_TERMS':
                        processLine(line, result.generalTerms, result.multiPartGeneralTerms);
                        break;
                    case 'FORBIDDEN_TERMS':
                        const term = line.trim().replace(/[,，]$/, '');
                        if (term && !term.startsWith('//')) result.forbiddenTerms.push(term);
                        break;
                }
            }
        }

        if (!result.metadata.version) {
            throw new Error('文件格式错误：必须在文件头部包含 "版本号" 或 "version" 字段。');
        }
        if (Object.keys(result.terms).length === 0 && Object.keys(result.generalTerms).length === 0 && Object.keys(result.multiPartTerms).length === 0 && Object.keys(result.multiPartGeneralTerms).length === 0 && result.forbiddenTerms.length === 0) {
            throw new Error('文件格式错误：必须包含 "词条"、"通用词条" 或 "禁翻词条" 部分，且至少有一个有效词条。');
        }
        
        return result;
    }

    /**
     * 处理并解析不规范的 JSON 字符串
     */
    function sanitizeAndParseJson(jsonString) {
        if (typeof jsonString !== 'string') {
            throw new TypeError('输入内容无效，必须为字符串。');
        }
        const trimmedString = jsonString.trim();
        if (trimmedString === '') {
            throw new Error('输入内容无效，不能为空字符串。');
        }
        const sanitizedString = trimmedString
            .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
            .replace(/,\s*([}\]])/g, '$1');
        try {
            return JSON.parse(sanitizedString);
        } catch (error) {
            console.error("JSON 净化后解析失败:", error);
            console.error("净化后的内容:", sanitizedString);
            throw new Error(`JSON 格式严重错误，自动净化未能修复此问题: ${error.message}`);
        }
    }

    /**
     * 从 GitHub 导入在线术语表文件
     */
    function importOnlineGlossary() {
        const exampleUrl = 'https://raw.githubusercontent.com/YourUsername/YourRepo/main/glossaryName.txt';
        const url = prompt(
            '请输入 Github 术语表文件链接。\n\n示例\n' + exampleUrl,
            ''
        );
        if (!url || !url.trim()) { return; }

        const githubRawRegex = /^https:\/\/raw\.githubusercontent\.com(\/[^\/]+)+$/;
        if (!githubRawRegex.test(url)) {
            alert("链接格式不正确。请输入一个有效的 GitHub Raw 文件链接。");
            return;
        }

        const glossaryName = decodeURIComponent(url.split('/').pop().replace(/\.[^/.]+$/, ''));
        notifyAndLog(`正在下载并导入 “${glossaryName}”...`);
        
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            onload: function(response) {
                if (response.status !== 200) {
                    notifyAndLog(`下载 “${glossaryName}” 失败！\n服务器返回状态码: ${response.status}`, '导入错误', 'error');
                    return;
                }
                try {
                    let onlineData;
                    try {
                        onlineData = parseCustomGlossaryFormat(response.responseText);
                        console.log(`“${glossaryName}” 已通过自定义格式成功解析。`);
                    } catch (customError) {
                        console.warn(`自定义格式解析失败，将回退至标准 JSON 解析器。原因: ${customError.message}`);
                        const jsonData = sanitizeAndParseJson(response.responseText);
                        if (!jsonData.version || typeof jsonData.terms !== 'object') {
                            throw new Error('JSON 格式不规范，缺少 "version" 或 "terms" 字段。');
                        }
                        onlineData = {
                            metadata: {
                                maintainer: jsonData.maintainer || '未知',
                                version: jsonData.version,
                                last_updated: jsonData.last_updated || new Date().toISOString()
                            },
                            terms: jsonData.terms,
                            generalTerms: {},
                            multiPartTerms: {},
                            multiPartGeneralTerms: {},
                            forbiddenTerms: []
                        };
                        console.log(`“${glossaryName}” 已通过 JSON 格式成功解析。`);
                    }

                    const allImportedGlossaries = GM_getValue(IMPORTED_GLOSSARY_KEY, {});
                    allImportedGlossaries[url] = {
                        terms: onlineData.terms,
                        generalTerms: onlineData.generalTerms,
                        multiPartTerms: onlineData.multiPartTerms,
                        multiPartGeneralTerms: onlineData.multiPartGeneralTerms,
                        forbiddenTerms: onlineData.forbiddenTerms
                    };
                    GM_setValue(IMPORTED_GLOSSARY_KEY, allImportedGlossaries);
                    
                    const metadata = GM_getValue(GLOSSARY_METADATA_KEY, {});
                    metadata[url] = { 
                        ...onlineData.metadata,
                        last_imported: new Date().toISOString() 
                    };
                    GM_setValue(GLOSSARY_METADATA_KEY, metadata);

                    const importedCount = Object.keys(onlineData.terms).length + Object.keys(onlineData.generalTerms).length + Object.keys(onlineData.multiPartTerms).length + Object.keys(onlineData.multiPartGeneralTerms).length;
                    const maintainerName = onlineData.metadata.maintainer || '未知';
                    notifyAndLog(`已成功导入 “${glossaryName}” 术语表。\n版本号：${onlineData.metadata.version}，维护者：${maintainerName}。共 ${importedCount} 个词条。`, '导入成功');

                } catch (e) {
                    console.error(`处理 “${glossaryName}” 时发生严重错误:`, e);
                    notifyAndLog(`导入 “${glossaryName}” 失败：${e.message}\n请检查文件格式是否符合自定义格式或标准 JSON 格式。`, '处理错误', 'error');
                }
            },
            onerror: function(error) {
                console.error(`下载 “${glossaryName}” 时发生网络错误:`, error);
                notifyAndLog(`下载 “${glossaryName}” 失败！\n请检查网络连接或链接是否正确。`, '网络错误', 'error');
            }
        });
    }

    /**
     * 管理已导入的在线术语表
     */
    function manageImportedGlossaries() {
        const metadata = GM_getValue(GLOSSARY_METADATA_KEY, {});
        const urls = Object.keys(metadata);
        if (urls.length === 0) {
            alert('您尚未导入任何在线术语表。');
            return;
        }
        const urlListText = urls.map((url, index) => {
            const glossaryName = decodeURIComponent(url.split('/').pop().replace(/\.[^/.]+$/, ''));
            const maintainer = metadata[url].maintainer || '未知';
            const version = metadata[url].version;
            return `${index + 1}. ${glossaryName}\n    版本：v${version}，维护者：${maintainer}`;
        }).join('\n');
        const choice = prompt(
            '若您想要移除某个术语表，请输入对应编号（仅输入数字）。注意，此操作彻底移除该在线术语表及其所有词条。\n\n' + urlListText,
            ''
        );
        if (!choice || !choice.trim()) { return; }
        const index = parseInt(choice, 10) - 1;
        if (isNaN(index) || index < 0 || index >= urls.length) {
            alert('输入无效，请输入列表中的正确编号。');
            return;
        }
        const urlToRemove = urls[index];
        const glossaryNameToRemove = decodeURIComponent(urlToRemove.split('/').pop().replace(/\.[^/.]+$/, ''));
        if (!confirm(`您确定要移除 “${glossaryNameToRemove}” 这个术语表吗？`)) {
            return;
        }
        notifyAndLog(`正在移除 “${glossaryNameToRemove}”...`, '请稍候');
        delete metadata[urlToRemove];
        GM_setValue(GLOSSARY_METADATA_KEY, metadata);
        const allImportedGlossaries = GM_getValue(IMPORTED_GLOSSARY_KEY, {});
        delete allImportedGlossaries[urlToRemove];
        GM_setValue(IMPORTED_GLOSSARY_KEY, allImportedGlossaries);
        notifyAndLog(`已成功移除 “${glossaryNameToRemove}” 术语表。`, '操作完成');
    }

    /**
     * 清空所有术语表
     */
    function clearAllGlossaries() {
        if (confirm('您确定要清空所有术语表吗？\n此操作将删除您手动添加的本地词条及所有在线导入术语表，且无法撤销。')) {
            GM_setValue(LOCAL_GLOSSARY_KEY, {});
            GM_setValue(LOCAL_FORBIDDEN_TERMS_KEY, []);
            GM_setValue(IMPORTED_GLOSSARY_KEY, {});
            GM_setValue(GLOSSARY_METADATA_KEY, {});
            notifyAndLog('所有术语表已被成功清空。', '操作完成');
        }
    }

	/**
	 * 检查并更新所有已导入的在线术语表
	 */
    async function checkForGlossaryUpdates() {
        const metadata = GM_getValue(GLOSSARY_METADATA_KEY, {});
        const urls = Object.keys(metadata);
        const LOG_PREFIX = '[术语表更新]';

        if (urls.length === 0) {
            return;
        }
        
        console.log(`${LOG_PREFIX} 开始后台检查 ${urls.length} 个在线术语表...`);

        let updatedCount = 0;
        let failedCount = 0;
        const allImportedGlossaries = GM_getValue(IMPORTED_GLOSSARY_KEY, {});

        for (const url of urls) {
            const glossaryName = decodeURIComponent(url.split('/').pop().replace(/\.[^/.]+$/, ''));
            
            console.log(`${LOG_PREFIX} 正在处理: “${glossaryName}”`);

            try {
                const response = await new Promise((resolve, reject) => {
                    const urlWithCacheBust = url + '?t=' + new Date().getTime();
                    GM_xmlhttpRequest({ method: 'GET', url: urlWithCacheBust, onload: resolve, onerror: reject });
                });

                if (response.status !== 200) {
                    throw new Error(`服务器返回状态码: ${response.status}`);
                }

                const onlineData = parseCustomGlossaryFormat(response.responseText);
                const localVersion = metadata[url].version;
                const onlineVersion = onlineData.metadata.version;

                if (onlineVersion && compareVersions(onlineVersion, localVersion) > 0) {
                    console.log(`${LOG_PREFIX} 更新发现: “${glossaryName}” v${localVersion} -> v${onlineVersion}`);

                    allImportedGlossaries[url] = {
                        terms: onlineData.terms,
                        generalTerms: onlineData.generalTerms,
                        multiPartTerms: onlineData.multiPartTerms,
                        multiPartGeneralTerms: onlineData.multiPartGeneralTerms,
                        forbiddenTerms: onlineData.forbiddenTerms
                    };
                    metadata[url] = { ...onlineData.metadata, last_updated: new Date().toISOString() };
                    
                    updatedCount++;
                
                } else {
                    console.log(`${LOG_PREFIX} 已是最新: “${glossaryName}” (v${localVersion})`);
                }
            } catch (e) {
                failedCount++;
                console.error(`${LOG_PREFIX} 检查失败: “${glossaryName}”。错误: ${e.message}`);
            }
        }

        if (updatedCount > 0) {
            GM_setValue(IMPORTED_GLOSSARY_KEY, allImportedGlossaries);
            GM_setValue(GLOSSARY_METADATA_KEY, metadata);
        }

        const summaryMessage = `后台检查完成！总计 ${urls.length} 个，更新 ${updatedCount} 个，失败 ${failedCount} 个。`;
        console.log(`${LOG_PREFIX} ${summaryMessage}`);
    }

    /**
     * 获取数组元素的所有排列组合
     */
    function getPermutations(arr) {
        if (arr.length <= 1) return [arr];
        const result = [];
        for (let i = 0; i < arr.length; i++) {
            const current = arr[i];
            const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
            const permsOfRemaining = getPermutations(remaining);
            for (const perm of permsOfRemaining) {
                result.push([current, ...perm]);
            }
        }
        return result;
    }

	/**
	 * 术语表处理函数
	 */
    async function getGlossaryProcessedParagraphs(paragraphs) {
        const allImportedGlossaries = GM_getValue(IMPORTED_GLOSSARY_KEY, {});
        const localGlossary = GM_getValue(LOCAL_GLOSSARY_KEY, {});
        
        const combined = {
            localTerms: {},
            importedForbidden: [],
            importedTerms: {}, 
            importedGeneralTerms: {},
            importedMultiPartTerms: {}, 
            importedMultiPartGeneralTerms: {}
        };
        
        Object.assign(combined.localTerms, localGlossary);

        for (const url in allImportedGlossaries) {
            const data = allImportedGlossaries[url];
            if (data) {
                combined.importedForbidden.push(...(data.forbiddenTerms || []));
                Object.assign(combined.importedTerms, data.terms || {});
                Object.assign(combined.importedGeneralTerms, data.generalTerms || {});
                Object.assign(combined.importedMultiPartTerms, data.multiPartTerms || {});
                Object.assign(combined.importedMultiPartGeneralTerms, data.multiPartGeneralTerms || {});
            }
        }

        const replacementMap = new Map();

        const processTerms = (terms, isGeneral, targetMap) => {
            for (const term in terms) {
                const termKey = term.toLowerCase();
                if (!targetMap.has(termKey)) {
                    const translation = terms[term];
                    targetMap.set(termKey, { base: translation, poss: translation + '的', original: term, isGeneral });
                }
            }
        };

        const processMultiPartTerms = (terms, isGeneral, targetMap) => {
            for (const term in terms) {
                const translation = terms[term];
                const termParts = term.split(' ').filter(p => p);
                const translationParts = translation.split(/\s+/).filter(p => p);

                if (termParts.length > 1 && termParts.length === translationParts.length) {
                    const fullTranslation = translationParts.join('');
                    const translationWithDe = fullTranslation + '的';
                    
                    const termPermutations = getPermutations(termParts);
                    for (const perm of termPermutations) {
                        const permKey = perm.join(' ').toLowerCase();
                        if (!targetMap.has(permKey)) {
                            targetMap.set(permKey, { base: fullTranslation, poss: translationWithDe, original: perm.join(' '), isGeneral });
                        }
                    }

                    for (let i = 0; i < termParts.length; i++) {
                        const partTermKey = termParts[i].toLowerCase();
                        if (!targetMap.has(partTermKey)) {
                            const partTranslation = translationParts[i];
                            targetMap.set(partTermKey, { base: partTranslation, poss: partTranslation + '的', original: termParts[i], isGeneral });
                        }
                    }
                }
            }
        };

        processMultiPartTerms(combined.localTerms, false, replacementMap);
        processTerms(combined.localTerms, false, replacementMap);
        
        const onlineForbiddenTerms = combined.importedForbidden.filter(term => !replacementMap.has(term.toLowerCase()));

        processMultiPartTerms(combined.importedMultiPartGeneralTerms, true, replacementMap);
        processMultiPartTerms(combined.importedMultiPartTerms, false, replacementMap);
        processTerms(combined.importedGeneralTerms, true, replacementMap);
        processTerms(combined.importedTerms, false, replacementMap);

        const originalKeys = [...replacementMap.keys()];
        const vowels = 'aeiou';

        for (const termKey of originalKeys) {
            const data = replacementMap.get(termKey);
            const originalTerm = data.original;

            if (originalTerm.includes(' ')) {
                continue;
            }

            let pluralForm;
            
            if (originalTerm.length > 1 && originalTerm.endsWith('y') && !vowels.includes(originalTerm.charAt(originalTerm.length - 2).toLowerCase())) {
                pluralForm = originalTerm.slice(0, -1) + 'ies';
            } else if (/[sxz]$/i.test(originalTerm) || /(ch|sh)$/i.test(originalTerm)) {
                pluralForm = originalTerm + 'es';
            } else if (!originalTerm.endsWith('s')) {
                pluralForm = originalTerm + 's';
            }

            if (pluralForm) {
                const pluralKey = pluralForm.toLowerCase();
                if (!replacementMap.has(pluralKey)) {
                    replacementMap.set(pluralKey, {
                        ...data,
                        original: pluralForm
                    });
                }
            }
        }

        const sortedRoots = Array.from(replacementMap.keys()).sort((a, b) => b.length - a.length);
        const sortedForbiddenRoots = onlineForbiddenTerms.sort((a, b) => b.length - a.length);

        return paragraphs.map(p => {
            const clone = p.cloneNode(true);
            const treeWalker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
            let currentNode;
            while (currentNode = treeWalker.nextNode()) {
                let text = currentNode.nodeValue;

                if (sortedForbiddenRoots.length > 0) {
                    for (const term of sortedForbiddenRoots) {
                        const escapedTerm = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        const regex = new RegExp(`\\b(${escapedTerm}(?:s|es)?)\\b`, 'g');
                        text = text.replace(regex, (matched) => `__KEEP_${matched}__`);
                    }
                }

                if (sortedRoots.length > 0) {
                    const regexPattern = sortedRoots.map(root => {
                        const data = replacementMap.get(root);
                        const escapedRoot = data.original.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                        return `(${escapedRoot})`;
                    }).join('|');
                    const finalRegex = new RegExp(`\\b(${regexPattern})((?:'s|s|es)?)\\b`, 'g');

                    text = text.replace(finalRegex, (match, term, suffix) => {
                        const lowerTerm = term.toLowerCase().replace(/[\s-]+/g, ' ');
                        const data = replacementMap.get(lowerTerm);
                        if (data) {
                            if (!data.isGeneral && data.original !== term) return match;
                            return suffix ? data.poss : data.base;
                        }
                        return match;
                    });
                }
                
                text = text.replace(/__KEEP_(.*?)__/g, '$1');

                currentNode.nodeValue = text;
            }
            return clone;
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
	 * 翻译文本处理函数
	 */
	const AdvancedTranslationCleaner = new (class {
		constructor() {
			this.metaKeywords = [
				'原文', '输出', '说明', '遵守', '润色', '语境', '保留', '符合', '指令',
				'Original text', 'Output', 'Note', 'Stage', 'Strategy', 'Polish', 'Retain', 'Glossary', 'Adherence'
			];
			this.junkLineRegex = new RegExp(`^\\s*(\\d+\\.\\s*)?(${this.metaKeywords.join('|')})[:：\\s]`, 'i');
			this.lineNumbersRegex = /^\d+\.\s*/;
			this.aiGenericExplanationRegex = /\s*\uff08[\u4e00-\u9fa5]{1,10}\uff1a[^\uff08\uff09]*?\uff09\s*/g;
		}
		clean(text) {
			if (!text || typeof text !== 'string') {
				return '';
			}
			let cleanedText = text.split('\n').filter(line => !this.junkLineRegex.test(line)).join('\n');
			cleanedText = cleanedText.replace(this.lineNumbersRegex, '');
            cleanedText = cleanedText.replace(this.aiGenericExplanationRegex, '');
			cleanedText = cleanedText.replace(/(<(em|strong)[^>]*>)([\s\S]*?)(<\/\2>)/g, (_match, openTag, _tagName, content, closeTag) => {
				return openTag + content.trim() + closeTag;
			});
			cleanedText = cleanedText.replace(/([\u4e00-\u9fa5])\s+(<(em|strong))/g, '$1$2');
			cleanedText = cleanedText.replace(/(<\/(em|strong)>)\s+([\u4e00-\u9fa5])/g, '$1$3');
			cleanedText = cleanedText.replace(/(<\/[a-z0-9]+>)\s+(<(em|strong))/g, '$1$2');
			cleanedText = cleanedText.replace(/(<\/(em|strong)>)\s+(<[a-z0-9]+[^>]*>)/g, '$1$2');
			cleanedText = cleanedText.replace(/([\u4e00-\u9fa5])([a-zA-Z0-9])/g, '$1 $2');
			cleanedText = cleanedText.replace(/([a-zA-Z0-9])([\u4e00-\u9fa5])/g, '$1 $2');
			cleanedText = cleanedText.replace(/\s+(?=<em|<strong)/g, '');
			cleanedText = cleanedText.replace(/(?<=<\/em>|<\/strong>)\s+/g, '');
			cleanedText = cleanedText.replace(/([a-zA-Z0-9])(<(em|strong))/g, '$1 $2');
			cleanedText = cleanedText.replace(/(<\/(em|strong)>)([a-zA-Z0-9])/g, '$1 $2');
			cleanedText = cleanedText.replace(/\s+/g, ' ');
			return cleanedText.trim();
		}
	})();

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
     * 显示通知时打印到控制台
     * @param {string} message - 主要消息内容
     * @param {string} [title='AO3 汉化插件'] - 通知的标题
     * @param {'info'|'warn'|'error'} [logType='info'] - 控制台日志的类型
     */
    function notifyAndLog(message, title = 'AO3 汉化插件', logType = 'info') {
        const logMessage = `[${title}] ${message.replace(/\n/g, ' ')}`;
        
        switch (logType) {
            case 'warn':
                console.warn(logMessage);
                break;
            case 'error':
                console.error(logMessage);
                break;
            default:
                console.info(logMessage);
                break;
        }

        GM_notification(message, title);
    }

    let menuCommandIds = [];
        let currentMenuView = 'main'; 

    /**
     * 菜单渲染函数
     */
	function renderMenuCommands() {
		menuCommandIds.forEach(id => GM_unregisterMenuCommand(id));
		menuCommandIds = [];

		const register = (text, callback) => {
			menuCommandIds.push(GM_registerMenuCommand(text, callback));
		};

		const engineMenuConfig = {
			'together_ai': {
				displayName: 'Together AI',
				modelGmKey: 'together_model',
				modelMapping: {
					'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8': 'Llama 4',
					'deepseek-ai/DeepSeek-V3': 'DeepSeek V3'
				},
				apiKeySetupFunction: null
			},
			'zhipu_ai': {
				displayName: 'Zhipu AI',
				modelGmKey: null,
				apiKeySetupFunction: setupZhipuAIKey
			},
			'deepseek_ai': {
				displayName: 'DeepSeek',
				modelGmKey: 'deepseek_model',
				modelMapping: {
					'deepseek-chat': 'DeepSeek V3',
					'deepseek-reasoner': 'DeepSeek R1'
				},
				apiKeySetupFunction: setupDeepSeekKey
			},
			'google_ai': {
				displayName: 'Google AI',
				modelGmKey: 'google_ai_model',
				modelMapping: {
					'gemini-2.5-pro': 'Gemini 2.5 Pro',
					'gemini-2.5-flash': 'Gemini 2.5 Flash',
					'gemini-2.5-flash-lite': 'Gemini 2.5 Flash-Lite'
				},
				apiKeySetupFunction: setupGoogleAiKeys
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
				apiKeySetupFunction: setupGroqAIKey
			}
		};

		const isAiTranslationEnabled = GM_getValue('enable_transDesc', false);

		if (currentMenuView === 'main') {
			register(isAiTranslationEnabled ? '禁用 AI 翻译功能' : '启用 AI 翻译功能', () => {
				const newState = !isAiTranslationEnabled;
				GM_setValue('enable_transDesc', newState);
				FeatureSet.enable_transDesc = newState;
				notifyAndLog(`AI 翻译功能已${newState ? '启用' : '禁用'}`);
				if (newState) {
					transDesc();
				} else {
					document.querySelectorAll('.translate-me-ao3-wrapper, .translated-by-ao3-script, .translated-by-ao3-script-error').forEach(el => el.remove());
					document.querySelectorAll('[data-translation-handled="true"], [data-state="translated"]').forEach(el => {
						delete el.dataset.translationHandled;
						delete el.dataset.state;
					});
				}
				renderMenuCommands();
			});

			if (isAiTranslationEnabled) {
				register('管理 AI 翻译术语表', () => {
					currentMenuView = 'glossary';
					renderMenuCommands();
				});

				const currentMode = GM_getValue('translation_display_mode', 'bilingual');
				const modeText = currentMode === 'bilingual' ? '双语对照' : '仅译文';
				register(`⇄ 翻译模式：${modeText}`, () => {
					const newMode = currentMode === 'bilingual' ? 'translation_only' : 'bilingual';
					GM_setValue('translation_display_mode', newMode);
					applyDisplayModeChange(newMode);
					notifyAndLog(`翻译模式已切换为: ${newMode === 'bilingual' ? '双语对照' : '仅译文'}`);
					renderMenuCommands();
				});

				const currentEngineId = getValidEngineName();
				const currentEngineConfig = engineMenuConfig[currentEngineId];
				register(`⇄ 翻译服务：${currentEngineConfig.displayName}`, () => {
					currentMenuView = 'select_service';
					renderMenuCommands();
				});

				if (currentEngineConfig.modelGmKey && currentEngineConfig.modelMapping) {
					const modelOrder = Object.keys(currentEngineConfig.modelMapping);
					const currentModelId = GM_getValue(currentEngineConfig.modelGmKey, modelOrder[0]);
					const currentModelIndex = modelOrder.indexOf(currentModelId);
					const nextModelIndex = (currentModelIndex + 1) % modelOrder.length;
					const nextModelId = modelOrder[nextModelIndex];
					register(`⇄ 使用模型：${currentEngineConfig.modelMapping[currentModelId]}`, () => {
						GM_setValue(currentEngineConfig.modelGmKey, nextModelId);
						notifyAndLog(`${currentEngineConfig.displayName} 模型已切换为: ${currentEngineConfig.modelMapping[nextModelId]}`);
						renderMenuCommands();
					});
				}

				if (currentEngineConfig.apiKeySetupFunction) {
					register(`▶ 设置 ${currentEngineConfig.displayName} API Key`, currentEngineConfig.apiKeySetupFunction);
				}
			}
		}
		else if (currentMenuView === 'select_service') {
			register('← 返回到主菜单', () => {
				currentMenuView = 'main';
				renderMenuCommands();
			});

			const currentEngineId = getValidEngineName();
			Object.keys(engineMenuConfig).forEach(engineId => {
				if (engineId !== currentEngineId) {
					const { displayName } = engineMenuConfig[engineId];
					register(`⇄ 切换至：${displayName}`, () => {
						GM_setValue('transEngine', engineId);
						currentMenuView = 'main';
						notifyAndLog(`翻译服务已切换为: ${displayName}`);
						renderMenuCommands();
					});
				}
			});
		}
		else if (currentMenuView === 'glossary') {
			register('←返回到主菜单', () => {
				currentMenuView = 'main';
				renderMenuCommands();
			});
			register('设置本地术语表', manageGlossary);
			register('设置禁翻术语表', manageForbiddenTerms);
			register('导入在线术语表', importOnlineGlossary);
			register('管理已有术语表', manageImportedGlossaries);
			register('清空所有术语表', clearAllGlossaries);
		}
	}

    /**
     * 动态应用翻译翻译模式的函数
     * @param {string} mode - '双语对照' 或 '仅译文'
     */
    function applyDisplayModeChange(mode) {
        const translatedBlocks = document.querySelectorAll('#chapters .userstuff .translated-by-ao3-script');
        translatedBlocks.forEach(translatedNode => {
            const originalNode = translatedNode.previousElementSibling;
            if (originalNode && originalNode.dataset.translationState === 'translated') {
                originalNode.style.display = (mode === 'translation_only') ? 'none' : '';
            }
        });
    }

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
     * main 函数，初始化翻译功能。确保在正确时机调用 transDesc
     */
    function main() {
        (function() {
            const oldGlossaryKey = 'ao3_translation_glossary';
            const newLocalGlossaryKey = 'ao3_local_glossary';
            const oldGlossaryData = GM_getValue(oldGlossaryKey, null);
            if (oldGlossaryData && typeof oldGlossaryData === 'object' && Object.keys(oldGlossaryData).length > 0) {
                console.log('AO3 汉化插件：检测到旧版术语表数据，正在迁移...');
                GM_setValue(newLocalGlossaryKey, oldGlossaryData);
                GM_deleteValue(oldGlossaryKey);
                console.log('AO3 汉化插件：术语表数据迁移成功！');
                GM_notification('您的自定义翻译词条已成功迁移到新版本！', 'AO3 汉化插件');
            }
        })();
        (function() {
            const oldChatglmKey = GM_getValue('chatglm_api_key', null);
            if (oldChatglmKey) {
                console.log('AO3 汉化插件：检测到旧版 API Key 数据，正在迁移至新版...');
                GM_setValue('zhipu_api_key', oldChatglmKey);
                GM_deleteValue('chatglm_api_key');
                console.log('AO3 汉化插件：API Key 迁移成功！');
                GM_notification('您的 ChatGLM API Key 已成功迁移为 Zhipu AI API Key！', 'AO3 汉化插件');
            } 
            else {
                const oldZhipuAiKey = GM_getValue('zhipu_ai_api_key', null);
                if (oldZhipuAiKey) {
                    console.log('AO3 汉化插件：检测到旧版 API Key 数据，正在迁移至新版...');
                    GM_setValue('zhipu_api_key', oldZhipuAiKey);
                    GM_deleteValue('zhipu_ai_api_key');
                    console.log('AO3 汉化插件：API Key 迁移成功！');
                    GM_notification('您的 Zhipu AI API Key 已成功更新至最新标准！', 'AO3 汉化插件');
                }
            }
        })();
        checkForGlossaryUpdates(false);
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

            if (FeatureSet.enable_transDesc) {
                setTimeout(transDesc, 1000);
            }
        }
        renderMenuCommands();
        watchUpdate();
    }

    /**
     * watchUpdate 函数：监视页面变化，根据变化的节点进行翻译。
     */
    function watchUpdate() {
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

        // 通用的后处理器和格式化函数
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
     * 脚本主入口检查
     */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }

})(window, document);