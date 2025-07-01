// ==UserScript==
// @name         AO3 汉化插件
// @namespace    https://github.com/V-Lipset/ao3-chinese
// @description  中文化 AO3 界面，可调用 ChatGLM 实现简介、注释、评论以及全文翻译。
// @version      1.0.0-2025-06-29
// @author       V-Lipset
// @license      GPL-3.0
// @match        https://archiveofourown.org/*
// @icon         https://archiveofourown.org/favicon.ico
// @supportURL   https://github.com/V-Lipset/ao3-chinese/issues
// @downloadURL  https://raw.githubusercontent.com/V-Lipset/ao3-chinese/main/main.user.js
// @updateURL    https://raw.githubusercontent.com/V-Lipset/ao3-chinese/main/main.user.js
// @require      https://raw.githubusercontent.com/V-Lipset/ao3-chinese/main/zh-cn.js
// @connect      open.bigmodel.cn
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_notification
// ==/UserScript==

(function (window, document, undefined) {
    'use strict';

    /****************** 全局配置区 ******************/
    const FeatureSet = {
        enable_RegExp: GM_getValue('enable_RegExp', true),
        enable_transDesc: GM_getValue('enable_transDesc', false),
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
        // 文本分块与请求限流的配置
        CHUNK_SIZE: 1200, // 每次请求最大文本长度
        PARAGRAPH_LIMIT: 4,   // 每次请求最大段落数
        REQUEST_DELAY: 200, // 每次API请求之间的延迟（毫秒）

        transEngine: 'chatglm_official',
        TRANS_ENGINES: {
            chatglm_official: {
                name: 'ChatGLM',
                url_api: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                getRequestData: (text) => {
                    let customInstructions = '';
                    const customDictString = GM_getValue('chatglm_custom_dict', '{}');
                    try {
                        const customDict = JSON.parse(customDictString);
                        const rules = Object.entries(customDict)
                            .map(([key, value]) => `"${key}" must be translated as "${value}"`)
                            .join(', ');
                        if (rules) {
                            customInstructions = `\n\nTranslation Rules: You must follow these rules strictly. ${rules}.`;
                        }
                    } catch (e) { /* 忽略格式错误的词典 */ }

                    // 应用System Prompt和Prompt模板
                    const system_prompt = `You are an expert translator specializing in fanfiction and online literature from various languages. Your primary function is to accurately identify the source language of a given text and then translate it into natural, fluent Simplified Chinese. You must preserve the original's tone, cultural nuances, idiomatic expressions, and any fandom-specific terminology. Your output must be *only* the translated text, without any additional notes, explanations, or language identification labels.${customInstructions}`;
                    const user_prompt = `Translate the following text to Simplified Chinese, providing only the translation itself:\n\n${text}`;

                    return {
                        model: "glm-4-flash",
                        messages: [
                            { "role": "system", "content": system_prompt },
                            { "role": "user", "content": user_prompt }
                        ],
                        stream: false,
                        temperature: 0,
                    };
                },
                responseIdentifier: 'choices[0].message.content',
            }
        }
    };

    let pageConfig = {};

    // 更新页面设置
    function updatePageConfig(currentPageChangeTrigger) {
        const newType = detectPageType();
        if (newType && newType !== pageConfig.currentPageType) {
            pageConfig = buildPageConfig(newType);
        } else if (!pageConfig.currentPageType && newType) {
            pageConfig = buildPageConfig(newType);
        }
    }

    // 构建页面设置 pageConfig 对象
    function buildPageConfig(pageType = pageConfig.currentPageType) {
        const baseStatic = I18N[CONFIG.LANG]?.public?.static || {};

        const usersCommonStatic = (pageType.startsWith('users_') || pageType === 'profile' || pageType === 'dashboard')
            ? I18N[CONFIG.LANG]?.users_common?.static || {}
            : {};

        const pageStatic = I18N[CONFIG.LANG]?.[pageType]?.static || {};

        const mergedStatic = { ...baseStatic, ...usersCommonStatic, ...pageStatic };

        const baseRegexp = I18N[CONFIG.LANG]?.public?.regexp || [];
        const pageRegexp = I18N[CONFIG.LANG]?.[pageType]?.regexp || [];
        const baseSelector = I18N[CONFIG.LANG]?.public?.selector || [];
        const pageSelector = I18N[CONFIG.LANG]?.[pageType]?.selector || [];
        const baseInnerHTMLRegexp = I18N[CONFIG.LANG]?.public?.innerHTML_regexp || [];
        const pageInnerHTMLRegexp = I18N[CONFIG.LANG]?.[pageType]?.innerHTML_regexp || [];

        const globalFlexible = (pageType === 'admin_posts_show') ? {} : (I18N[CONFIG.LANG]?.flexible || {});
        const pageFlexible = (pageType === 'admin_posts_show') ? {} : (I18N[CONFIG.LANG]?.[pageType]?.flexible || {});

        const mergedRegexp = [...pageRegexp, ...baseRegexp];
        const mergedSelector = [...pageSelector, ...baseSelector];
        const mergedInnerHTMLRegexp = [...pageInnerHTMLRegexp, ...baseInnerHTMLRegexp];

        return {
            currentPageType: pageType,
            staticDict: mergedStatic,
            regexpRules: mergedRegexp,
            innerHTMLRules: mergedInnerHTMLRegexp,
            globalFlexibleDict: globalFlexible,
            pageFlexibleDict: pageFlexible,
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
     * @param {Node} node - 需要遍历的节点。
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
     * @returns {string|boolean} 页面的类型，如果无法确定类型，那么返回 'common' 或 false。
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
        const { hostname, pathname, search } = window.location;
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
                case 'series':
                    if (p2 && /^\d+$/.test(p2)) return 'series_show';
                    if (!p2) return 'series_index';
                    break;
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
     * transTitle 函数：翻译页面标题
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
     * @param {Element|DOMStringMap|Node} el - 需要翻译的元素或元素的数据集 (node.dataset) or Text Node.
     * @param {string} field - 需要翻译的属性名称或文本内容字段
     */
    function transElement(el, field) {
        if (!el || !el[field]) return false;
        const text = el[field];
        if (typeof text !== 'string' || !text.trim()) return false;
        const translatedText = transText(text);
        if (translatedText && translatedText !== text) {
            try {
                el[field] = translatedText;
            } catch (e) {
            }
        }
    }



    /**
     * transText 函数：翻译文本内容
     * @param {string} text - 需要翻译的文本内容。
     * @returns {string|false} 翻译后的文本内容，如果没有找到对应的翻译，那么返回 false。
     */
    function transText(text) {
        if (!text || typeof text !== 'string') return false;
        const originalText = text;
        let translatedText = text;

        // 辅助函数，用于执行一次灵活词典的替换
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
     * fetchTranslatedText 函数：从特定页面的词库中获得翻译文本内容。
     * @param {string} text - 需要翻译的文本内容
     * @returns {string|boolean} 翻译后的文本内容，如果没有找到对应的翻译，那么返回 false。
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


    // 文本分块函数
    function chunkText(paragraphs) {
        const chunks = [];
        let currentChunk = [];
        let currentCharCount = 0;

        for (const p of paragraphs) {
            const pLength = p.textContent.length;
            if (pLength === 0) continue;

            if (
                currentChunk.length > 0 &&
                (currentCharCount + pLength > CONFIG.CHUNK_SIZE || currentChunk.length >= CONFIG.PARAGRAPH_LIMIT)
            ) {
                chunks.push(currentChunk);
                currentChunk = [];
                currentCharCount = 0;
            }

            currentChunk.push(p);
            currentCharCount += pLength;
        }

        if (currentChunk.length > 0) {
            chunks.push(currentChunk);
        }
        return chunks;
    }

    // 延时函数
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }


    // 翻译并显示单个段落的函数
    async function translateAndDisplayParagraph(pElement) {
        if (pElement.dataset.translated === 'true') return;
        pElement.dataset.translated = 'true'; // 标记为已处理，防止重复翻译

        const originalText = pElement.textContent.trim();
        if (!originalText) return;

        try {
            const translatedText = await requestRemoteTranslation(originalText);
            if (translatedText && !translatedText.startsWith('翻译失败')) {
                const translationNode = document.createElement('p');
                translationNode.className = 'translated-by-ao3-script';
                translationNode.style.cssText = 'color: #777; margin-top: 0.25em; margin-bottom: 1em;';
                translationNode.textContent = translatedText;
                pElement.after(translationNode);
            }
        } catch (e) {
            console.error('Paragraph translation failed:', e);
        }
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
     * 通用的按钮添加函数
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
            if (wrapper.dataset.state === 'translated' && canClear) {
                const translatableSelectors = 'p, blockquote, li, h1, h2, h3:not(.landmark), h4, h5, h6';
                let units = Array.from(element.querySelectorAll(translatableSelectors));
                if (units.length === 0) {
                    units = [element];
                }

                units.forEach(unit => {
                    const nextEl = unit.nextElementSibling;
                    if (nextEl && nextEl.classList.contains('translated-by-ao3-script')) {
                        nextEl.remove();
                    }
                    delete unit.dataset.translationState;
                });
                buttonLink.textContent = originalButtonText;
                delete wrapper.dataset.state;
                return;
            }
            buttonLink.removeEventListener('click', handleClick);
            buttonLink.textContent = canClear ? '翻译中…' : '翻译已启用...';

            if (!canClear) {
                 buttonLink.style.cursor = 'default';
                 buttonLink.style.color = '#777';
            }

            startImmersiveTranslation(element, () => {
                if (canClear) {
                    buttonLink.textContent = '已翻译';
                    wrapper.dataset.state = 'translated';
                    buttonLink.addEventListener('click', handleClick);
                }
            });
        };

        buttonLink.addEventListener('click', handleClick);
    }

    /**
     * 主分发函数：根据是否有回调，决定是为“区块”还是为“正文”启动翻译
     */
    function startImmersiveTranslation(containerElement, onComplete) {
        if (onComplete) {
            runImmersiveTranslationForBlock(containerElement, onComplete);
        } else {
            runImmersiveTranslationWithObserver(containerElement);
        }
    }

    /**
     * 核心翻译引擎(区块模式)：用于简介和注释。会一次性翻译完区块内的所有段落。
     * @param {HTMLElement} containerElement - 容器元素
     * @param {function} onComplete - 全部翻译完成后的回调
     */
    async function runImmersiveTranslationForBlock(containerElement, onComplete) {
        const translatableSelectors = 'p, blockquote, li, h1, h2, h3:not(.landmark), h4, h5, h6';
        let units = Array.from(containerElement.querySelectorAll(translatableSelectors));
        if (units.length === 0 && containerElement.textContent.trim()) {
            units = [containerElement];
        }
        try {
            for (const unit of units) {
                if (unit.dataset.translationState) continue;
                unit.dataset.translationState = 'translating';

                const originalText = unit.textContent.trim();
                if (!originalText) {
                    unit.dataset.translationState = 'translated';
                    continue;
                }

                const translatedText = await requestRemoteTranslation(originalText);
                const transNode = document.createElement('div');
                transNode.className = 'translated-by-ao3-script';
                transNode.style.cssText = 'color: #777; margin-top: 0.25em; margin-bottom: 1em;';
                transNode.textContent = translatedText;
                unit.after(transNode);
                unit.dataset.translationState = 'translated';
                
                await sleep(CONFIG.REQUEST_DELAY); // API请求间隔
            }
        } catch (e) {
            console.error("Block translation failed:", e);
        } finally {
            onComplete?.();
        }
    }

    /**
     * 核心翻译引擎：用于正文。懒加载，只翻译进入视野的段落。
     * @param {HTMLElement} containerElement - 容器元素
     */
    function runImmersiveTranslationWithObserver(containerElement) {
        const translatableSelectors = 'p, blockquote, li, h1, h2, h3, h4, h5, h6';
        const units = Array.from(containerElement.querySelectorAll(translatableSelectors));

        const observer = new IntersectionObserver(async (entries, obs) => {
            const unitsToTranslate = entries
                .filter(e => e.isIntersecting)
                .map(e => e.target)
                .filter(unit => !unit.dataset.translationState);

            if (unitsToTranslate.length === 0) return;
            unitsToTranslate.forEach(unit => unit.dataset.translationState = 'translating');

            for (const unit of unitsToTranslate) {
                const originalText = unit.textContent.trim();
                if (!originalText) {
                    unit.dataset.translationState = 'translated';
                    obs.unobserve(unit);
                    continue;
                }
                try {
                    const translatedText = await requestRemoteTranslation(originalText);
                    const transNode = document.createElement('div');
                    transNode.className = 'translated-by-ao3-script';
                    transNode.style.cssText = 'color: #777; margin-top: 0.25em; margin-bottom: 1em;';
                    transNode.textContent = translatedText;
                    unit.after(transNode);
                    unit.dataset.translationState = 'translated';
                    obs.unobserve(unit);
                } catch (e) {
                    console.error("Lazy translation failed for unit:", unit, e);
                    delete unit.dataset.translationState;
                }
                await sleep(CONFIG.REQUEST_DELAY);
            }
        }, { rootMargin: '200px 0px 400px 0px' });

        units.forEach(unit => observer.observe(unit));
    }


    /**
     * getNestedProperty 函数：获取嵌套属性的安全函数
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
     * requestRemoteTranslation 函数：将指定的文本发送到设定的翻译引擎进行翻译。
     */
    async function requestRemoteTranslation(text) {
        return new Promise((resolve) => {
            // 获取 ChatGLM 配置
            const engineConfig = CONFIG.TRANS_ENGINES.chatglm_official;
            if (!engineConfig) {
                resolve('翻译失败 (引擎未配置)');
                return;
            }

            const { url_api, method, getRequestData, responseIdentifier } = engineConfig;
            let headers = { ...engineConfig.headers };
            const apiKey = GM_getValue('chatglm_api_key');

            // 1. 未设置 API Key 的情况
            if (!apiKey) {
                const userMessage = '翻译失败！请先在篡改猴脚本菜单中点击 "设置 ChatGLM API Key" 进行配置。';
                resolve(userMessage);
                GM_notification(userMessage, {title: 'AO3汉化插件提示'});
                return;
            }
            
            headers['Authorization'] = `Bearer ${apiKey}`;
            const requestData = getRequestData(text);

            GM_xmlhttpRequest({
                method: method,
                url: url_api,
                headers: headers,
                data: method.toUpperCase() === 'POST' ? JSON.stringify(requestData) : null,
                responseType: 'json',
                timeout: 30000,
                onload: (res) => {
                    try {
                        // 2. API 返回错误（包括无效 Key 的情况）
                        if (res.response && res.response.error) {
                            const errorCode = res.response.error.code;
                            if (errorCode && String(errorCode).startsWith('130')) {
                                const userMessage = '翻译失败！当前ChatGLM API Key不可用。';
                                resolve(userMessage);
                                GM_notification(userMessage, {title: 'AO3汉化插件提示', text: `API 错误: ${res.response.error.message}`});
                                return;
                            }
                        }
                        
                        // 3. 请求成功，但未找到翻译文本
                        const translatedText = getNestedProperty(res.response, responseIdentifier);
                        if (!translatedText) {
                        throw new Error('API did not return a translation.');
                        }
                        
                        // 4. 完美成功
                        resolve(translatedText);

                    } catch (err) {
                        console.error('Translation parsing error:', err);
                        resolve('翻译失败！解析 API 响应时出错。');
                    }
                },
                onerror: (err) => {
                    console.error('Translation request error:', err);
                    resolve('翻译失败！网络请求错误。');
                },
                ontimeout: () => {
                    console.error('Translation request timed out.');
                    resolve('翻译失败！请求超时。');
                }
            });
        });
    }


    /**
     * 设置用户自己的 ChatGLM API Key
     */
    function setupChatGLMKey() {
        const currentKey = GM_getValue('chatglm_api_key', '');
        const newKey = prompt('请输入您的智谱AI (ChatGLM) API Key:', currentKey);
        if (newKey !== null) {
            GM_setValue('chatglm_api_key', newKey.trim());
            GM_notification(newKey.trim() ? 'ChatGLM API Key 已保存！' : 'ChatGLM API Key 已清除！');
        }
    }

    /**
     * 设置 ChatGLM 的自定义词典
     */
    function setupCustomDictionary() {
        const savedDictString = GM_getValue('chatglm_custom_dict', '{}');
        const example = '示例:\n{\n  "Wakaba Mutsumi": "若叶睦",\n  "Tsukinomori Girls\' Academy": "月之森女子学园"\n}';
        const newDictString = prompt(`请输入自定义词典（JSON格式），键为原文，值为译文。\n留空则清除词典。\n\n${example}`, savedDictString);

        if (newDictString !== null) {
            try {
                JSON.parse(newDictString.trim() || '{}');
                GM_setValue('chatglm_custom_dict', newDictString.trim() || '{}');
                GM_notification('自定义词典已保存！');
            } catch (e) {
                alert('格式错误！请输入有效的JSON字符串。');
                GM_notification('自定义词典保存失败，格式错误。', {title: '错误'});
            }
        }
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


    let menuCommandIds = []; // 用于存储所有注册的菜单命令ID

    /**
     * 核心菜单渲染函数：
     * 每次状态变更时，都重新构建整个菜单，以保证顺序和状态的正确性。
     */
    function renderMenuCommands() {
        menuCommandIds.forEach(id => GM_unregisterMenuCommand(id));
        menuCommandIds = [];
        const menuConfigs = [
            {
                label: 'ChatGLM 翻译功能',
                key: 'enable_transDesc',
                callback: newFeatureState => {
                    if (newFeatureState) {
                        transDesc();
                    } else {
                        document.querySelectorAll('.translate-me-ao3-wrapper').forEach(el => el.remove());
                        document.querySelectorAll('.translated-by-ao3-script').forEach(el => el.remove());
                        const translationTargets = [
                           { selector: 'div.summary blockquote.userstuff' },
                           { selector: 'div.notes.module .userstuff' },
                           { selector: '.preface .notes.module .userstuff' },
                           { selector: '.end.notes.module .userstuff' },
                           { selector: 'div#notes > p' },
                           { selector: '#chapters .userstuff' }
                        ];
                        const allSelectors = translationTargets.map(t => t.selector).join(', ');
                        document.querySelectorAll(allSelectors).forEach(el => {
                            if (el.dataset.originalHtml) {
                                el.innerHTML = el.dataset.originalHtml;
                            }
                            delete el.dataset.translationHandled;
                            delete el.dataset.translationState;
                            delete el.dataset.originalHtml;
                        });
                    }
                }
            }
        ];

        menuConfigs.forEach(config => {
            const { label, key, callback } = config;
            const isEnabled = FeatureSet[key];
            const menuLabel = `${isEnabled ? '禁用' : '启用'} ${label}`;

            const commandId = GM_registerMenuCommand(menuLabel, () => {
                const newState = !isEnabled;
                FeatureSet[key] = newState;
                GM_setValue(key, newState);
                GM_notification(`${label} 已${newState ? '启用' : '禁用'}`);
                if (callback) callback(newState);
                renderMenuCommands();
            });
            menuCommandIds.push(commandId);
        });
        menuCommandIds.push(GM_registerMenuCommand('设置 ChatGLM API Key', setupChatGLMKey));
        menuCommandIds.push(GM_registerMenuCommand('设置 ChatGLM 自定义词典', setupCustomDictionary));
    }


    /**
     * 通用后处理函数：处理块级元素末尾的孤立标点
     * @param {HTMLElement} [rootElement=document]
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
     * watchUpdate 函数：
     * 监视页面变化，根据变化的节点进行翻译。
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

        // 1. 通用的后处理器和格式化函数
        handleTrailingPunctuation(rootElement);
        translateFirstLoginBanner();
        translateSymbolsKeyModal(rootElement);
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
        // 统一寻找并重新格式化所有日期容器
        const dateSelectors = [
            '.header.module .meta span.published', // 适用于新闻/公告的日期容器
            'li.collection .summary p:has(abbr.day)', // 适用于所有合集/挑战列表项中的截止日期段落
            '.comment .posted.datetime', // 适用于评论的发布日期
            '.comment .edited.datetime', // 适用于评论的编辑日期
            'dd.datetime', // 处理所有<dd>中的日期，如挑战信息
            'p:has(> span.datetime)', // 用于匹配“最后生成于”这样的段落
        ];
        rootElement.querySelectorAll(dateSelectors.join(', '))
            .forEach(reformatDateInElement); // 统一调用通用日期格式化函数
        // 2. 根据当前页面类型，调用页面专属的翻译和处理函数
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