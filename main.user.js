// ==UserScript==
// @name         AO3 汉化插件
// @namespace    https://github.com/V-Lipset/ao3-chinese
// @description  中文化 AO3 界面，可调用 AI 实现简介、注释、评论以及全文翻译。
// @version      1.5.6-2025-10-16
// @author       V-Lipset
// @license      GPL-3.0
// @match        https://archiveofourown.org/*
// @match        https://archiveofourown.gay/*
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
// @connect      fanyi.baidu.com
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

	/**
     * 语言选项常量
     */
    const ALL_LANG_OPTIONS = [
        ["zh-CN", "简体中文"],
        ["zh-TW", "繁體中文"],
        ["ar", "العربية"],
        ["bg", "Български"],
        ["bn", "বাংলা"],
        ["ca", "Català"],
        ["cs", "Čeština"],
        ["da", "Dansk"],
        ["de", "Deutsch"],
        ["el", "Ελληνικά"],
        ["en", "English"],
        ["es", "Español"],
        ["et", "Eesti"],
        ["fa", "فارسی"],
        ["fi", "Suomi"],
        ["fr", "Français"],
        ["gu", "ગુજરાતી"],
        ["he", "עברית"],
        ["hi", "हिन्दी"],
        ["hr", "Hrvatski"],
        ["hu", "Magyar"],
        ["id", "Indonesia"],
        ["is", "Íslenska"],
        ["it", "Italiano"],
        ["ja", "日本語"],
        ["kn", "ಕನ್ನಡ"],
        ["ko", "한국어"],
        ["lt", "Lietuvių"],
        ["lv", "Latviešu"],
        ["ml", "മലയാളം"],
        ["mr", "मराठी"],
        ["ms", "Melayu"],
        ["mt", "Malti"],
        ["nl", "Nederlands"],
        ["no", "Norsk"],
        ["pa", "ਪੰਜਾਬੀ"],
        ["pl", "Polski"],
        ["pt", "Português"],
        ["ro", "Română"],
        ["ru", "Русский"],
        ["sk", "Slovenčina"],
        ["sl", "Slovenščina"],
        ["sv", "Svenska"],
        ["sw", "Kiswahili"],
        ["ta", "தமிழ்"],
        ["te", "తెలుగు"],
        ["th", "ไทย"],
        ["tr", "Türkçe"],
        ["uk", "Українська"],
        ["ur", "اردو"],
        ["vi", "Tiếng Việt"],
        ["zu", "isiZulu"],
    ];

	/**
     * 语言代码到自然语言名称的映射
     */
    const LANG_CODE_TO_NAME = {
        'zh-CN': 'Simplified Chinese (简体中文)',
        'zh-TW': 'Traditional Chinese (繁體中文)',
        'ar': 'Arabic (العربية)',
        'bg': 'Bulgarian (Български)',
        'bn': 'Bengali (বাংলা)',
        'ca': 'Catalan (Català)',
        'cs': 'Czech (Čeština)',
        'da': 'Danish (Dansk)',
        'de': 'German (Deutsch)',
        'el': 'Greek (Ελληνικά)',
        'en': 'English',
        'es': 'Spanish (Español)',
        'et': 'Estonian (Eesti)',
        'fa': 'Persian (فارسی)',
        'fi': 'Finnish (Suomi)',
        'fr': 'French (Français)',
        'gu': 'Gujarati (ગુજરાતી)',
        'he': 'Hebrew (עברית)',
        'hi': 'Hindi (हिन्दी)',
        'hr': 'Croatian (Hrvatski)',
        'hu': 'Hungarian (Magyar)',
        'id': 'Indonesian (Indonesia)',
        'is': 'Icelandic (Íslenska)',
        'it': 'Italian (Italiano)',
        'ja': 'Japanese (日本語)',
        'kn': 'Kannada (ಕನ್ನಡ)',
        'ko': 'Korean (한국어)',
        'lt': 'Lithuanian (Lietuvių)',
        'lv': 'Latvian (Latviešu)',
        'ml': 'Malayalam (മലയാളം)',
        'mr': 'Marathi (मराठी)',
        'ms': 'Malay (Melayu)',
        'mt': 'Maltese (Malti)',
        'nl': 'Dutch (Nederlands)',
        'no': 'Norwegian (Norsk)',
        'pa': 'Punjabi (ਪੰਜਾਬੀ)',
        'pl': 'Polish (Polski)',
        'pt': 'Portuguese (Português)',
        'ro': 'Romanian (Română)',
        'ru': 'Russian (Русский)',
        'sk': 'Slovak (Slovenčina)',
        'sl': 'Slovenian (Slovenščina)',
        'sv': 'Swedish (Svenska)',
        'sw': 'Swahili (Kiswahili)',
        'ta': 'Tamil (தமிழ்)',
        'te': 'Telugu (తెలుగు)',
        'th': 'Thai (ไทย)',
        'tr': 'Turkish (Türkçe)',
        'uk': 'Ukrainian (Українська)',
        'ur': 'Urdu (اردو)',
        'vi': 'Vietnamese (Tiếng Việt)',
        'zu': 'Zulu (isiZulu)',
    };

	/**
     * 针对不同目标语言的输出示例数据
     */
    const PROMPT_EXAMPLE_OUTPUTS = {
        'zh-CN': `1. 这是<em>第一个</em>句子。\n2. ---\n3. 她的名字是 ph_123456。\n4. 这是第四个句子。`,
        'zh-TW': `1. 這是<em>第一個</em>句子。\n2. ---\n3. 她的名字是 ph_123456。\n4. 這是第四個句子。`,
        'ar': `1. هذه هي الجملة <em>الأولى</em>.\n2. ---\n3. اسمها هو ph_123456.\n4. هذه هي الجملة الرابعة.`,
        'bg': `1. Това е <em>първото</em> изречение.\n2. ---\n3. Нейното име е ph_123456.\n4. Това е четвъртото изречение.`,
        'bn': `1. এটি <em>প্রথম</em> বাক্য।\n2. ---\n3. তার নাম ph_123456।\n4. এটি চতুর্থ বাক্য।`,
        'ca': `1. Aquesta és la <em>primera</em> frase.\n2. ---\n3. El seu nom és ph_123456.\n4. Aquesta és la quarta frase.`,
        'cs': `1. Toto je <em>první</em> věta.\n2. ---\n3. Jmenuje se ph_123456.\n4. Toto je čtvrtá věta.`,
        'da': `1. Dette er den <em>første</em> sætning.\n2. ---\n3. Hendes navn er ph_123456.\n4. Dette er den fjerde sætning.`,
        'de': `1. Das ist der <em>erste</em> Satz.\n2. ---\n3. Ihr Name ist ph_123456.\n4. Das ist der vierte Satz.`,
        'el': `1. Αυτή είναι η <em>πρώτη</em> πρόταση.\n2. ---\n3. Το όνομά της είναι ph_123456.\n4. Αυτή είναι η τέταρτη πρόταση.`,
        'es': `1. Esta es la <em>primera</em> frase.\n2. ---\n3. Su nombre es ph_123456.\n4. Esta es la cuarta frase.`,
        'et': `1. See on <em>esimene</em> lause.\n2. ---\n3. Tema nimi on ph_123456.\n4. See on neljas lause.`,
        'fa': `1. این <em>اولین</em> جمله است.\n2. ---\n3. نام او ph_123456 است.\n4. این چهارمین جمله است.`,
        'fi': `1. Tämä on <em>ensimmäinen</em> lause.\n2. ---\n3. Hänen nimensä on ph_123456.\n4. Tämä on neljäs lause.`,
        'fr': `1. C'est la <em>première</em> phrase.\n2. ---\n3. Son nom est ph_123456.\n4. C'est la quatrième phrase.`,
        'gu': `1. આ <em>પહેલું</em> વાક્ય છે।\n2. ---\n3. તેનું નામ ph_123456 છે।\n4. આ ચોથું વાક્ય છે।`,
        'he': `1. זהו המשפט ה<em>ראשון</em>.\n2. ---\n3. שמה הוא ph_123456.\n4. זהו המשפט הרביעי.`,
        'hi': `1. यह <em>पहला</em> वाक्य है।\n2. ---\n3. उसका नाम ph_123456 है।\n4. यह चौथा वाक्य है।`,
        'hr': `1. Ovo je <em>prva</em> rečenica.\n2. ---\n3. Njeno ime je ph_123456.\n4. Ovo je četvrta rečenica.`,
        'hu': `1. Ez az <em>első</em> mondat.\n2. ---\n3. A neve ph_123456.\n4. Ez a negyedik mondat.`,
        'id': `1. Ini adalah kalimat <em>pertama</em>.\n2. ---\n3. Namanya adalah ph_123456.\n4. Ini adalah kalimat keempat.`,
        'is': `1. Þetta er <em>fyrsta</em> setningin.\n2. ---\n3. Hún heitir ph_123456.\n4. Þetta er fjórða setningin.`,
        'it': `1. Questa è la <em>prima</em> frase.\n2. ---\n3. Il suo nome è ph_123456.\n4. Questa è la quarta frase.`,
        'ja': `1. これは<em>最初の</em>文です。\n2. ---\n3. 彼女の名前は ph_123456 です。\n4. これは4番目の文です。`,
        'kn': `1. ಇದು <em>ಮೊದಲ</em> ವಾಕ್ಯ।\n2. ---\n3. ಅವಳ ಹೆಸರು ph_123456।\n4. ಇದು ನಾಲ್ಕನೇ ವಾಕ್ಯ।`,
        'ko': `1. 이것은 <em>첫 번째</em> 문장입니다。\n2. ---\n3. 그녀의 이름은 ph_123456 입니다。\n4. 이것은 네 번째 문장입니다。`,
        'lt': `1. Tai yra <em>pirmas</em> sakinys.\n2. ---\n3. Jos vardas yra ph_123456.\n4. Tai yra ketvirtas sakinys.`,
        'lv': `1. Šis ir <em>pirmais</em> teikums.\n2. ---\n3. Viņas vārds ir ph_123456.\n4. Šis ir ceturtais teikums.`,
        'ml': `1. ഇതാണ് <em>ഒന്നാമത്തെ</em> വാക്യം।\n2. ---\n3. അവളുടെ പേര് ph_123456 എന്നാണ്।\n4. ഇതാണ് നാലാമത്തെ വാക്യം।`,
        'mr': `1. हे <em>पहिले</em> वाक्य आहे।\n2. ---\n3. तिचे नाव ph_123456 आहे।\n4. हे चौथे वाक्य आहे।`,
        'ms': `1. Ini adalah ayat <em>pertama</em>.\n2. ---\n3. Namanya ialah ph_123456.\n4. Ini adalah ayat keempat.`,
        'mt': `1. Din hija l-<em>ewwel</em> sentenza.\n2. ---\n3. Jisimha hu ph_123456.\n4. Din hija r-raba' sentenza.`,
        'nl': `1. Dit is de <em>eerste</em> zin.\n2. ---\n3. Haar naam is ph_123456.\n4. Dit is de vierde zin.`,
        'no': `1. Dette er den <em>første</em> setningen.\n2. ---\n3. Hennes navn er ph_123456.\n4. Dette er den fjerde setningen.`,
        'pa': `1. ਇਹ <em>ਪਹਿਲਾ</em> ਵਾਕ ਹੈ।\n2. ---\n3. ਉਸਦਾ ਨਾਮ ph_123456 ਹੈ।\n4. ਇਹ ਚੌਥਾ ਵਾਕ ਹੈ।`,
        'pl': `1. To jest <em>pierwsze</em> zdanie.\n2. ---\n3. Nazywa się ph_123456.\n4. To jest czwarte zdanie.`,
        'pt': `1. Esta é a <em>primeira</em> frase.\n2. ---\n3. O nome dela é ph_123456.\n4. Esta é a quarta frase.`,
        'ro': `1. Aceasta este <em>prima</em> propoziție.\n2. ---\n3. Numele ei este ph_123456.\n4. Aceasta este a patra propoziție.`,
        'ru': `1. Это <em>первое</em> предложение.\n2. ---\n3. Её зовут ph_123456.\n4. Это четвёртое предложение.`,
        'sk': `1. Toto je <em>prvá</em> veta.\n2. ---\n3. Volá sa ph_123456.\n4. Toto je štvrtá veta.`,
        'sl': `1. To je <em>prvi</em> stavek.\n2. ---\n3. Ime ji je ph_123456.\n4. To je četrti stavek.`,
        'sv': `1. Detta är den <em>första</em> meningen.\n2. ---\n3. Hennes namn är ph_123456.\n4. Detta är den fjärde meningen.`,
        'sw': `1. Hii ni sentensi ya <em>kwanza</em>.\n2. ---\n3. Jina lake ni ph_123456.\n4. Hii ni sentensi ya nne.`,
        'ta': `1. இது <em>முதல்</em> வாக்கியம்.\n2. ---\n3. அவள் பெயர் ph_123456.\n4. இது நான்காவது வாக்கியம்.`,
        'te': `1. ఇది <em>మొదటి</em> వాక్యం.\n2. ---\n3. ఆమె పేరు ph_123456.\n4. ఇది నాల్గవ వాక్యం.`,
        'th': `1. นี่คือประโยค<em>แรก</em>\n2. ---\n3. ชื่อของเธอคือ ph_123456\n4. นี่คือประโยคที่สี่`,
        'tr': `1. Bu <em>birinci</em> cümledir.\n2. ---\n3. Onun adı ph_123456.\n4. Bu dördüncü cümledir.`,
        'uk': `1. Це <em>перше</em> речення.\n2. ---\n3. Її звати ph_123456.\n4. Це четверте речення.`,
        'ur': `1. یہ <em>پہلا</em> جملہ ہے۔\n2. ---\n3. اس کا نام ph_123456 ہے۔\n4. یہ چوتھا جملہ ہے۔`,
        'vi': `1. Đây là câu <em>đầu tiên</em>.\n2. ---\n3. Tên cô ấy là ph_123456.\n4. Đây là câu thứ tư.`,
        'zu': `1. Lona umusho <em>wokuqala</em>.\n2. ---\n3. Igama lakhe ngu-ph_123456.\n4. Lona umusho wesine.`,
        'default': `1. This is the <em>first</em> sentence.\n2. ---\n3. Her name is ph_123456.\n4. This is the fourth sentence.`
    };

/**
     * 根据目标语言动态生成完整的提示示例
     */
    function generatePromptExample(toLang) {
        const exampleOutputText = PROMPT_EXAMPLE_OUTPUTS[toLang] || PROMPT_EXAMPLE_OUTPUTS['zh-CN'];
        return `### Example Output:\n${exampleOutputText}`;
    }

/**
     * 获取 AI 翻译系统提示词模板
     */
    function getSharedSystemPrompt() {
        return `You are a professional translator fluent in {toLangName}, with particular expertise in translating web novels and online fanfiction from {fromLangName}.

Your task is to translate a numbered list of text segments provided by the user. These segments can be anything from full paragraphs to single phrases or words. For each numbered item, you will follow an internal three-stage strategy to produce the final, polished translation.

### Internal Translation Strategy (for each item):
1.  **Stage 1 (Internal Thought Process):** Produce a literal, word-for-word translation of the original content.
2.  **Stage 2 (Internal Thought Process):** Based on the literal translation, identify any phrasing that is unnatural or does not flow well in the target language.
3.  **Stage 3 (Final Output):** Produce a polished, idiomatic translation that fully preserves the original meaning, tone, cultural nuances, and any specialized fandom terminology. The final translation must be natural-sounding, readable, and conform to standard usage in {toLangName}.

### CRITICAL OUTPUT INSTRUCTIONS:
- Your entire response MUST consist of *only* the polished translation from Stage 3, formatted as a numbered list that exactly matches the input's numbering.
- Do NOT include any stage numbers, headers (e.g., "Polished Translation"), notes, or explanations in your final output.
- **HTML Tag Preservation:** If an item contains HTML tags (e.g., \`<em>\`, \`<strong>\`), you MUST preserve these tags exactly as they are in the original, including their positions around the translated text.
- **Placeholder Preservation:** If an item contains special placeholders in the format \`ph_\` followed by six digits (e.g., \`ph_123456\`), you MUST preserve these placeholders exactly as they are. DO NOT translate, modify, add spaces to, delete, or alter them in any way.
- **Untranslatable Content:** If an item is a separator, a meaningless symbol, or otherwise untranslatable, you MUST return the original item exactly as it is, preserving its number.

### Example Input:
1. This is the <em>first</em> sentence.
2. ---
3. Her name is ph_123456.
4. This is the fourth sentence.

{exampleOutput}
		`;
    }

    // 创建一个标准的、兼容OpenAI API的服务配置对象
    const createStandardApiConfig = ({ name, url }) => ({
        name: name,
        url_api: url,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        LAZY_LOAD_ROOT_MARGIN: '400px 0px 1000px 0px',

        // 谷歌翻译文本分块、懒加载边距
        MODEL_SPECIFIC_LIMITS: {
            'google_translate': {
                CHUNK_SIZE: 4000,
                PARAGRAPH_LIMIT: 20,
                LAZY_LOAD_ROOT_MARGIN: '1200px 0px 3000px 0px',
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
            openai: createStandardApiConfig({
                name: 'OpenAI',
                url: 'https://api.openai.com/v1/chat/completions',
            }),
            anthropic: {
                name: 'Anthropic',
                url_api: 'https://api.anthropic.com/v1/messages',
                method: 'POST',
                responseIdentifier: 'content[0].text',
            },
            zhipu_ai: createStandardApiConfig({
                name: 'Zhipu AI',
                url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
            }),
            deepseek_ai: createStandardApiConfig({
                name: 'DeepSeek',
                url: 'https://api.deepseek.com/chat/completions',
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
            groq_ai: createStandardApiConfig({
                name: 'Groq AI',
                url: 'https://api.groq.com/openai/v1/chat/completions',
            }),
            together_ai: createStandardApiConfig({
                name: 'Together AI',
                url: 'https://api.together.xyz/v1/chat/completions',
            }),
            cerebras_ai: createStandardApiConfig({
                name: 'Cerebras',
                url: 'https://api.cerebras.ai/v1/chat/completions',
            }),
            modelscope_ai: createStandardApiConfig({
                name: 'ModelScope',
                url: 'https://api-inference.modelscope.cn/v1/chat/completions',
            }),
        }
    };

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
                exportFormatVersion: "1.1",
                scriptVersion: GM_info.script.version,
                exportDate: getShanghaiTimeString(),
            },
            data: {
                staticKeys: {},
                apiKeys: {},
                modelSelections: {},
                customServices: [],
                glossaries: {},
                uiState: {},
                aiParameters: {}
            }
        };

        const staticKeys = [
            'enable_RegExp', 'enable_transDesc', 'show_fab', 'transEngine',
            'translation_display_mode', 'ao3_glossary_last_action',
            'from_lang', 'to_lang'
        ];
        for (const key of staticKeys) {
            const value = GM_getValue(key);
            if (value !== undefined) {
                allData.data.staticKeys[key] = value;
            }
        }

        const builtInServices = Object.keys(engineMenuConfig)
            .filter(id => id !== 'google_translate' && id !== ADD_NEW_CUSTOM_SERVICE_ID)
            .sort();
        for (const serviceId of builtInServices) {
            const apiKey = GM_getValue(`${serviceId}_keys_string`);
            if (apiKey !== undefined) {
                allData.data.apiKeys[`${serviceId}_keys_string`] = apiKey;
            }
            if (engineMenuConfig[serviceId].modelGmKey) {
                const model = GM_getValue(engineMenuConfig[serviceId].modelGmKey);
                if (model !== undefined) {
                    allData.data.modelSelections[engineMenuConfig[serviceId].modelGmKey] = model;
                }
            }
        }

        const customServicesList = GM_getValue(CUSTOM_SERVICES_LIST_KEY, []);
        customServicesList.sort((a, b) => a.id.localeCompare(b.id));
        for (const service of customServicesList) {
            const apiKey = GM_getValue(`${service.id}_keys_string`);
            allData.data.customServices.push({
                id: service.id,
                name: service.name,
                url: service.url,
                apiKey: apiKey,
                modelsRaw: service.modelsRaw,
                selectedModel: GM_getValue(`${ACTIVE_MODEL_PREFIX_KEY}${service.id}`),
                lastAction: GM_getValue(`custom_service_last_action_${service.id}`)
            });
            if (apiKey !== undefined) {
                allData.data.apiKeys[`${service.id}_keys_string`] = apiKey;
            }
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

        const aiParamKeys = [
            'custom_ai_system_prompt', 'custom_ai_user_prompt', 'custom_ai_temperature',
            'custom_ai_chunk_size', 'custom_ai_para_limit', 'custom_ai_lazy_load_margin',
            'ao3_ai_param_last_action'
        ];
        for (const key of aiParamKeys) {
            const value = GM_getValue(key);
            if (value !== undefined) {
                allData.data.aiParameters[key] = value;
            }
        }

        return allData;
    }

	/**
     * 校验并导入用户配置数据，并自动同步在线术语表
     */
    async function importAllData(jsonData, syncPanelStateCallback) {
        if (!jsonData || typeof jsonData !== 'object' || !jsonData.data || typeof jsonData.data !== 'object') {
            return { success: false, message: "文件格式无效或文件已损坏：缺少核心 'data' 模块。" };
        }

        const data = jsonData.data;

        if (data.staticKeys) {
            for (const [key, value] of Object.entries(data.staticKeys)) {
                if (value !== undefined) GM_setValue(key, value);
            }
        }

        if (data.apiKeys) {
            for (const [key, value] of Object.entries(data.apiKeys)) {
                if (value !== undefined) GM_setValue(key, value);
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
                if (!service || typeof service.id !== 'string') continue;
                newServiceList.push({
                    id: service.id,
                    name: service.name,
                    url: service.url,
                    modelsRaw: service.modelsRaw,
                    models: String(service.modelsRaw || '').replace(/[，]/g, ',').split(',').map(m => m.trim()).filter(Boolean)
                });

                const apiKeyToSet = service.apiKey !== undefined ? service.apiKey : (data.apiKeys ? data.apiKeys[`${service.id}_keys_string`] : undefined);
                if (apiKeyToSet !== undefined) GM_setValue(`${service.id}_keys_string`, apiKeyToSet);

                if (service.selectedModel !== undefined) GM_setValue(`${ACTIVE_MODEL_PREFIX_KEY}${service.id}`, service.selectedModel);
                if (service.lastAction !== undefined) GM_setValue(`custom_service_last_action_${service.id}`, service.lastAction);
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

        if (data.aiParameters) {
            for (const [key, value] of Object.entries(data.aiParameters)) {
                if (value !== undefined) GM_setValue(key, value);
            }
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
            .settings-panel-body { padding: 16px 16px 16px; display: flex; flex-direction: column; gap: 16px; max-height: 70vh; overflow-y: auto; }
            .settings-panel-body::-webkit-scrollbar,
            .custom-dropdown-menu ul::-webkit-scrollbar,
            .settings-group textarea.settings-control::-webkit-scrollbar {
                width: 5px;
            }
            .settings-panel-body::-webkit-scrollbar-track,
            .custom-dropdown-menu ul::-webkit-scrollbar-track,
            .settings-group textarea.settings-control::-webkit-scrollbar-track {
                background: transparent;
            }
            .settings-panel-body::-webkit-scrollbar-thumb,
            .custom-dropdown-menu ul::-webkit-scrollbar-thumb,
            .settings-group textarea.settings-control::-webkit-scrollbar-thumb {
                background: rgba(0, 0, 0, 0.2);
                border-radius: 3px;
            }

            .settings-switch-group { display: flex; justify-content: space-between; align-items: center; padding: 0; }
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

            .language-swap-container {
                display: flex;
                align-items: center;
                gap: 2px;
            }
            .language-swap-container .settings-group {
                flex: 1;
                min-width: 0;
            }
            #swap-lang-btn {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 18px;
                color: #555;
                padding: 0 4px;
                line-height: 1;
                transition: color 0.2s ease;
                flex-shrink: 0;
            }
            #swap-lang-btn:disabled {
                color: #a9a9a9;
                cursor: default;
            }
            #swap-lang-btn:focus {
                outline: none;
            }

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
                min-width: 0;
            }
            .settings-group textarea.settings-control {
                height: 72px !important;
                min-height: 72px !important;
                max-height: 72px !important;
                line-height: 1.5;
                padding-top: 8px;
                padding-bottom: 8px;
                resize: none;
            }
            .settings-group input[type="number"] {
                -moz-appearance: textfield;
            }
            .settings-group input[type="number"]::-webkit-inner-spin-button,
            .settings-group input[type="number"]::-webkit-outer-spin-button {
                -webkit-appearance: none;
                margin: 0;
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
            #ai-param-input-area .input-wrapper textarea.settings-input {
                padding-right: 12px !important;
            }
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
                text-overflow: clip;
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

            .settings-action-button-inline,
            .online-glossary-delete-btn,
            .custom-dropdown-menu li .item-action-btn,
            .data-sync-action-btn,
            #swap-lang-btn,
            div.translate-me-ao3-wrapper > div {
                -webkit-tap-highlight-color: transparent;
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

                <div class="language-swap-container">
                    <div class="settings-group settings-group-select">
                        <select id="setting-from-lang" class="settings-control settings-select custom-styled-select"></select>
                        <label for="setting-from-lang" class="settings-label">原文语言</label>
                    </div>
                    <button id="swap-lang-btn" title="互换">⇄</button>
                    <div class="settings-group settings-group-select">
                        <select id="setting-to-lang" class="settings-control settings-select custom-styled-select"></select>
                        <label for="setting-to-lang" class="settings-label">目标语言</label>
                    </div>
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
                        <option value="ai_settings">翻译参数自定义</option>
                        <option value="data_sync">数据导入与导出</option>
                    </select>
                    <label for="setting-glossary-actions" class="settings-label">更多功能</label>
                </div>

                <div id="data-sync-actions-container" class="data-sync-actions-container" style="display: none;">
                    <button id="btn-import-data" class="data-sync-action-btn">数据导入</button>
                    <button id="btn-export-data" class="data-sync-action-btn">数据导出</button>
                </div>

                <div id="editable-section-ai-settings" class="editable-section" style="display: none; flex-direction: column; gap: 16px;">
                    <div class="settings-group static-label settings-group-select">
                        <select id="ai-param-select" class="settings-control settings-select custom-styled-select">
                            <option value="system_prompt">System Prompt</option>
                            <option value="user_prompt">User Prompt</option>
                            <option value="temperature">Temperature</option>
                            <option value="chunk_size">每次翻译文本量</option>
                            <option value="para_limit">每次翻译段落数</option>
                            <option value="lazy_load_margin">懒加载参数设置</option>
                        </select>
                        <label for="ai-param-select" class="settings-label">参数选择</label>
                    </div>
                    <div id="ai-param-input-area"></div>
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
            swapLangBtn: panel.querySelector('#swap-lang-btn'),
            engineSelect: panel.querySelector('#setting-trans-engine'),
            fromLangSelect: panel.querySelector('#setting-from-lang'),
            toLangSelect: panel.querySelector('#setting-to-lang'),
            modelGroup: panel.querySelector('#setting-model-group'),
            modelSelect: panel.querySelector('#setting-trans-model'),
            displayModeSelect: panel.querySelector('#setting-display-mode'),
            apiKeyGroup: panel.querySelector('#api-key-group'),
            apiKeyInput: panel.querySelector('#setting-input-apikey'),
            apiKeySaveBtn: panel.querySelector('#setting-btn-apikey-save'),
            customServiceContainer: panel.querySelector('#custom-service-container'),
            glossaryActionsSelect: panel.querySelector('#setting-glossary-actions'),
            editableSections: panel.querySelectorAll('.editable-section'),
            aiSettingsSection: panel.querySelector('#editable-section-ai-settings'),
            aiParamSelect: panel.querySelector('#ai-param-select'),
            aiParamInputArea: panel.querySelector('#ai-param-input-area'),
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
    function showCustomConfirm(message, title = '提示') {
        return new Promise((resolve, reject) => {
            if (document.getElementById('ao3-custom-confirm-overlay')) {
                return reject(new Error('已有提示框正在显示中。'));
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

            const lastActionKey = `custom_service_last_action_${currentServiceId}`;
            GM_setValue(lastActionKey, currentEditSection);

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
                                window.open('https://v-lipset.github.io/docs/guides/whitelist', '_blank');
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
     * 清理无效的自定义服务配置
     */
    function cleanupAllEmptyCustomServices() {
        const services = GM_getValue(CUSTOM_SERVICES_LIST_KEY, []);
        const servicesToKeep = services.filter(s => {
            const hasName = s.name && s.name.trim() !== '';
            const hasUrl = s.url && s.url.trim() !== '';
            const hasModels = s.models && s.models.length > 0;
            const hasApiKey = GM_getValue(`${s.id}_keys_string`, '').trim() !== '';

            return hasName || hasUrl || hasModels || hasApiKey;
        });

        if (services.length !== servicesToKeep.length) {
            GM_setValue(CUSTOM_SERVICES_LIST_KEY, servicesToKeep);
            const currentEngine = GM_getValue('transEngine');
            const isCurrentEngineRemoved = !servicesToKeep.some(s => s.id === currentEngine);

            if (isCurrentEngineRemoved && currentEngine.startsWith('custom_')) {
                GM_setValue('transEngine', 'google_translate');
            }
        }
    }

    /**
     * 设置面板的内部逻辑
     */
    function initializeSettingsPanelLogic(panelElements, rerenderMenuCallback, onPanelCloseCallback) {
        const {
            panel, closeBtn, header, masterSwitch, swapLangBtn, engineSelect, fromLangSelect, toLangSelect,
            modelGroup, modelSelect, displayModeSelect,
            apiKeyGroup, apiKeyInput, apiKeySaveBtn, customServiceContainer,
            glossaryActionsSelect, editableSections,
            aiSettingsSection, aiParamSelect, aiParamInputArea,
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
        const AI_PARAM_ACTION_KEY = 'ao3_ai_param_last_action';
        let isDragging = false;
        let origin = { x: 0, y: 0 }, startPosition = { x: 0, y: 0 };
        let activeDropdown = null;

        const customServiceManager = createCustomServiceManager(panelElements, syncPanelState);

		function renderAiParamEditor() {
            const param = aiParamSelect.value;
            aiParamInputArea.innerHTML = '';

            const paramConfig = {
                system_prompt: { type: 'textarea', key: 'custom_ai_system_prompt', autoSave: true },
                user_prompt: { type: 'textarea', key: 'custom_ai_user_prompt', autoSave: true },
                temperature: { type: 'number', key: 'custom_ai_temperature', attrs: { min: 0, max: 2, step: 0.1 }, hint: ' (0-2)' },
                chunk_size: { type: 'number', key: 'custom_ai_chunk_size', attrs: { min: 100, step: 100 } },
                para_limit: { type: 'number', key: 'custom_ai_para_limit', attrs: { min: 1, step: 1 } },
                lazy_load_margin: { type: 'text', key: 'custom_ai_lazy_load_margin', hint: ' (px)' }
            };

            const defaults = {
                system_prompt: () => getSharedSystemPrompt(),
                user_prompt: () => `Translate the following numbered list to {toLangName}:\n\n{numberedText}`,
                temperature: () => 0,
                chunk_size: () => CONFIG.CHUNK_SIZE,
                para_limit: () => CONFIG.PARAGRAPH_LIMIT,
                lazy_load_margin: () => CONFIG.LAZY_LOAD_ROOT_MARGIN
            };

            const config = paramConfig[param];
            if (!config) return;

            const defaultValue = defaults[param]();
            let displayValue = GM_getValue(config.key, defaultValue);

            const section = document.createElement('div');
            section.className = 'settings-group static-label';

            const inputWrapper = document.createElement('div');
            inputWrapper.className = 'input-wrapper';

            const inputElement = document.createElement(config.type === 'textarea' ? 'textarea' : 'input');
            inputElement.id = `ai-param-input-${param}`;
            inputElement.className = 'settings-control settings-input';
            if (param === 'system_prompt' || param === 'user_prompt') {
                inputElement.setAttribute('spellcheck', 'false');
            }
            if (config.type !== 'textarea') {
                inputElement.type = config.type;
            }
            if (config.attrs) {
                Object.entries(config.attrs).forEach(([attr, val]) => inputElement.setAttribute(attr, val));
            }
            inputElement.value = displayValue;

            const label = document.createElement('label');
            label.htmlFor = inputElement.id;
            label.className = 'settings-label';
            let labelText = aiParamSelect.options[aiParamSelect.selectedIndex].text;
            if (config.hint) {
                labelText += config.hint;
            }
            label.textContent = labelText;

            inputWrapper.appendChild(inputElement);
            inputWrapper.appendChild(label);

            if (!config.autoSave) {
                const saveBtn = document.createElement('button');
                saveBtn.className = 'settings-action-button-inline';
                saveBtn.textContent = '保存';
                inputWrapper.appendChild(saveBtn);

                saveBtn.addEventListener('click', () => {
                    let valueToSave = inputElement.value;
                    if (config.type === 'number') {
                        const numValue = parseInt(valueToSave, 10);
                        if (isNaN(numValue) || (config.attrs.min !== undefined && numValue < config.attrs.min)) {
                            valueToSave = config.attrs.min;
                        } else {
                            valueToSave = numValue;
                        }
                        inputElement.value = valueToSave;
                    }
                    GM_setValue(config.key, valueToSave);
                    updateInputLabel(inputElement);
                });
            } else {
                inputElement.addEventListener('blur', () => {
                    let valueToSave = inputElement.value;
                    GM_setValue(config.key, valueToSave);
                });
            }

            section.appendChild(inputWrapper);
            aiParamInputArea.appendChild(section);

            updateInputLabel(inputElement);
        }

        function updateModelSelect(engineId) {
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
        }

        function updateApiKeySection(engineId) {
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
        }

        function updateUiForEngine(engineId) {
            customServiceContainer.style.display = 'none';
            modelGroup.style.display = 'none';
            apiKeyGroup.style.display = 'none';

            if (engineId.startsWith('custom_')) {
                customServiceManager.enterEditMode(engineId);
            } else {
                updateModelSelect(engineId);
                updateApiKeySection(engineId);
            }
            updateAllLabels();
        }

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

        function syncPanelState() {
            const isEnabled = GM_getValue('enable_transDesc', false);
            masterSwitch.checked = isEnabled;

            populateEngineSelect();
            const currentEngine = getValidEngineName();
            engineSelect.value = currentEngine;

            updateUiForEngine(currentEngine);

            fromLangSelect.value = GM_getValue('from_lang', 'auto');
            toLangSelect.value = GM_getValue('to_lang', 'zh-CN');
            updateSwapButtonState();

            displayModeSelect.value = GM_getValue('translation_display_mode', 'bilingual');

            panel.querySelectorAll('.settings-group').forEach(group => {
                group.classList.toggle('ao3-trans-control-disabled', !isEnabled);
            });
            panel.querySelectorAll('.settings-control, .settings-input, .settings-action-button-inline, .online-glossary-delete-btn, .data-sync-action-btn').forEach(el => {
                el.disabled = !isEnabled;
            });

            updateAllLabels();
        }

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
                if (sectionToShow.id === 'editable-section-glossary-manage' || sectionToShow.id === 'editable-section-ai-settings') {
                    sectionToShow.style.display = 'flex';
                } else {
                    sectionToShow.style.display = 'block';
                }
                const input = sectionToShow.querySelector('.settings-control');
                if (input) updateInputLabel(input);
            }
        };

        const saveApiKey = () => {
            const engineId = engineSelect.value;
            const value = apiKeyInput.value;
            let serviceIdToUpdate;

            if (engineId.startsWith('custom_')) {
                serviceIdToUpdate = engineId;
            } else if (engineId === ADD_NEW_CUSTOM_SERVICE_ID && customServiceManager.isPending()) {
                serviceIdToUpdate = customServiceManager.ensureServiceExists();
            } else {
                serviceIdToUpdate = engineId;
            }

            if (!serviceIdToUpdate) {
                return;
            }

            const stringKeyName = `${serviceIdToUpdate}_keys_string`;
            const arrayKeyName = `${serviceIdToUpdate}_keys_array`;

            GM_setValue(stringKeyName, value);

            const keysArray = value.replace(/[，]/g, ',').split(',').map(k => k.trim()).filter(Boolean);
            GM_setValue(arrayKeyName, keysArray);

            GM_deleteValue(`${serviceIdToUpdate}_key_index`);

            if (DEBUG_MODE) {
                console.log(`[调试日志] API Key 已为服务 ${serviceIdToUpdate} 保存并同步。`);
                console.log(`  - String: ${value}`);
                console.log(`  - Array:`, keysArray);
            }
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

        const handleExport = async () => {
            try {
                const data = await exportAllData();
                const jsonString = JSON.stringify(data, null, 2);
                const blob = new Blob([jsonString], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                const shanghaiDate = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 10);
                a.download = `AO3-Chinese-Script-Backup-${shanghaiDate}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                notifyAndLog('配置已成功导出！', '操作成功');
            } catch (e) {
                notifyAndLog(`导出失败: ${e.message}`, '操作失败', 'error');
                if (DEBUG_MODE) {
                    console.error("导出失败:", e);
                }
            }
        };

        const handleImport = () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;

                showCustomConfirm("您确定要导入该配置文件吗？\n这将覆盖您当前的所有设置，包括 API Key 、术语表、自定义翻译服务等。\n注意：此操作无法撤销。")
                    .then(() => {
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                            try {
                                const jsonData = JSON.parse(event.target.result);
                                const result = await importAllData(jsonData, syncPanelState);
                                if (result.success) {
                                    notifyAndLog(result.message, '导入成功');
                                } else {
                                    notifyAndLog(result.message, '导入失败', 'error');
                                }
                            } catch (err) {
                                notifyAndLog(`导入失败: 文件格式无效或已损坏。 ${err.message}`, '导入失败', 'error');
                                if (DEBUG_MODE) {
                                    console.error("导入失败:", err);
                                }
                            }
                        };
                        reader.readAsText(file);
                    })
                    .catch(() => {
                        notifyAndLog('导入操作已取消。', '操作取消');
                    });
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

        const updateSwapButtonState = () => {
            const isAutoDetect = fromLangSelect.value === 'auto';
            swapLangBtn.disabled = isAutoDetect;
        };

        const handleLanguageChange = () => {
            if (glossaryActionsSelect.value === 'ai_settings') {
                const currentParam = aiParamSelect.value;
                if (currentParam === 'system_prompt' || currentParam === 'user_prompt') {
                    renderAiParamEditor();
                }
            }
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

        swapLangBtn.addEventListener('click', () => {
            if (swapLangBtn.disabled) return;
            const fromLang = fromLangSelect.value;
            const toLang = toLangSelect.value;
            fromLangSelect.value = toLang;
            toLangSelect.value = fromLang;
            GM_setValue('from_lang', toLang);
            GM_setValue('to_lang', fromLang);
            fromLangSelect.dispatchEvent(new Event('change', { bubbles: true }));
            toLangSelect.dispatchEvent(new Event('change', { bubbles: true }));
        });

        fromLangSelect.addEventListener('change', () => {
            const newLang = fromLangSelect.value;
            GM_setValue('from_lang', newLang);
            updateSwapButtonState();
            handleLanguageChange();
        });

        toLangSelect.addEventListener('change', () => {
            const newLang = toLangSelect.value;
            GM_setValue('to_lang', newLang);
            handleLanguageChange();
        });

        engineSelect.addEventListener('change', () => {
            if (customServiceManager.isPending()) {
                customServiceManager.cancelPending();
            }
            const newEngine = engineSelect.value;

            if (newEngine === ADD_NEW_CUSTOM_SERVICE_ID) {
                customServiceManager.startPendingCreation();
            } else {
                GM_setValue('transEngine', newEngine);
                updateUiForEngine(newEngine);
            }
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
                case 'ai_settings':
                    toggleEditableSection(aiSettingsSection);
                    const lastAiAction = GM_getValue(AI_PARAM_ACTION_KEY, 'system_prompt');
                    aiParamSelect.value = lastAiAction;
                    renderAiParamEditor();
                    break;
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

        aiParamSelect.addEventListener('change', () => {
            GM_setValue(AI_PARAM_ACTION_KEY, aiParamSelect.value);
            renderAiParamEditor();
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
                    invalidateGlossaryCache();
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

        importDataBtn.addEventListener('click', () => handleImport());
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
            if (document.getElementById('ao3-custom-confirm-overlay')) {
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

        const populateLangSelects = () => {
            const fromOptions = [{ value: 'auto', text: '自动检测' }, ...ALL_LANG_OPTIONS.map(([value, text]) => ({ value, text }))];
            const toOptions = ALL_LANG_OPTIONS.map(([value, text]) => ({ value, text }));

            const createOptions = (select, options) => {
                select.innerHTML = '';
                options.forEach(({ value, text }) => {
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = text;
                    select.appendChild(option);
                });
            };
            createOptions(fromLangSelect, fromOptions);
            createOptions(toLangSelect, toOptions);
        };

        populateLangSelects();
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
            modelGmKey: 'zhipu_ai_model',
            modelMapping: {
                'glm-4.5-flash': 'GLM-4.5-Flash',
                'glm-4-flash-250414': 'GLM-4-Flash'
            },
            requiresApiKey: true
        },
        'deepseek_ai': {
            displayName: 'DeepSeek',
            modelGmKey: 'deepseek_model',
            modelMapping: {
                'deepseek-reasoner': 'DeepSeek V3.2 Think',
                'deepseek-chat': 'DeepSeek V3.2 Non-Think'
            },
            requiresApiKey: true
        },
        'google_ai': {
            displayName: 'Google AI',
            modelGmKey: 'google_ai_model',
            modelMapping: {
                'gemini-2.5-pro': 'Gemini 2.5 Pro',
                'gemini-flash-latest': 'Gemini 2.5 Flash',
                'gemini-flash-lite-latest': 'Gemini 2.5 Flash-Lite'
            },
            requiresApiKey: true
        },
        'groq_ai': {
            displayName: 'Groq AI',
            modelGmKey: 'groq_model',
            modelMapping: {
                'meta-llama/llama-4-maverick-17b-128e-instruct': 'Llama 4 Maverick',
                'meta-llama/llama-4-scout-17b-16e-instruct': 'Llama 4 Scout',
                'moonshotai/kimi-k2-instruct-0905': 'Kimi K2',
                'deepseek-r1-distill-llama-70b': 'DeepSeek 70B',
                'openai/gpt-oss-120b': 'GPT-OSS 120B'
            },
            requiresApiKey: true
        },
        'together_ai': {
            displayName: 'Together AI',
            modelGmKey: 'together_model',
            modelMapping: {
                'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8': 'Llama 4 Maverick',
                'deepseek-ai/DeepSeek-V3': 'DeepSeek V3',
                'moonshotai/Kimi-K2-Instruct': 'Kimi K2',
                'Qwen/Qwen3-235B-A22B-Instruct-2507-tput': 'Qwen3 235B'
            },
            requiresApiKey: true
        },
        'cerebras_ai': {
            displayName: 'Cerebras',
            modelGmKey: 'cerebras_model',
            modelMapping: {
                'llama-4-maverick-17b-128e-instruct': 'Llama 4 Maverick',
                'llama-4-scout-17b-16e-instruct': 'Llama 4 Scout',
                'qwen-3-235b-a22b-instruct-2507': 'Qwen 3 235B',
                'gpt-oss-120b': 'GPT-OSS 120B'
            },
            requiresApiKey: true
        },
        'modelscope_ai': {
            displayName: 'ModelScope',
            modelGmKey: 'modelscope_model',
            modelMapping: {
                'LLM-Research/Llama-4-Maverick-17B-128E-Instruct': 'Llama 4 Maverick',
                'deepseek-ai/DeepSeek-V3.1': 'DeepSeek V3.1',
                'ZhipuAI/GLM-4.6': 'GLM 4.6',
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

    /****************** 数据模型层 ******************/

    /**
     * 根据服务 ID 从存储中读取配置，并组装成一个标准化的 Provider 对象
     */
    function getProviderById(serviceId) {
        if (!serviceId) return null;

        // 处理内置服务
        if (engineMenuConfig[serviceId] && !serviceId.startsWith('custom_')) {
            const menuConfig = engineMenuConfig[serviceId];
            const apiConfig = CONFIG.TRANS_ENGINES[serviceId];

            if (!apiConfig) return null;

            const models = menuConfig.modelMapping ? Object.keys(menuConfig.modelMapping) : [];
            const selectedModel = menuConfig.modelGmKey ? GM_getValue(menuConfig.modelGmKey, models[0]) : null;

            return {
                id: serviceId,
                name: menuConfig.displayName,
                providerType: serviceId,
                apiHost: apiConfig.url_api || apiConfig.url,
                apiKey: GM_getValue(`${serviceId}_keys_string`, ''),
                models: models,
                selectedModel: selectedModel,
                isCustom: false
            };
        }

        // 处理自定义服务
        if (serviceId.startsWith('custom_')) {
            const customServices = GM_getValue(CUSTOM_SERVICES_LIST_KEY, []);
            const serviceConfig = customServices.find(s => s.id === serviceId);

            if (!serviceConfig) return null;

            const models = Array.isArray(serviceConfig.models) ? serviceConfig.models : [];
            const selectedModel = GM_getValue(`${ACTIVE_MODEL_PREFIX_KEY}${serviceId}`, models[0]);

            return {
                id: serviceId,
                name: serviceConfig.name,
                providerType: 'openai-compatible',
                apiHost: serviceConfig.url,
                apiKey: GM_getValue(`${serviceId}_keys_string`, ''),
                models: models,
                selectedModel: selectedModel,
                isCustom: true
            };
        }

        return null;
    }

    /****************** API 客户端层 ******************/

	/**
     * 所有 API 客户端的基类，定义了标准接口和通用翻译流程
     */
    class BaseApiClient {
        /**
         * @param {object} provider - 包含所有配置的服务提供商对象
         */
        constructor(provider) {
            this.provider = provider;
        }

        /**
         * 构建请求所需的 Headers
         */
        _buildHeaders() {
            throw new Error("'_buildHeaders' must be implemented by subclasses.");
        }

        /**
         * 构建请求所需的 Body
         */
        _buildBody(_paragraphs, _fromLang) {
            throw new Error("'_buildBody' must be implemented by subclasses.");
        }

        /**
         * 解析 API 返回的响应
         */
        _parseResponse(_response) {
            throw new Error("'_parseResponse' must be implemented by subclasses.");
        }

        /**
         * 处理特定于该客户端的 API 错误
         */
        _handleError(response, responseData) {
            const apiErrorMessage = getNestedProperty(responseData, 'error.message') || getNestedProperty(responseData, 'message') || response.statusText || '未知错误';
            const error = new Error();
            let userFriendlyError;
            error.noRetry = false;

            if (DEBUG_MODE) {
                console.group(`[调试日志] BaseApiClient._handleError 捕获错误`);
                console.log('服务名称:', this.provider.name);
                console.log('HTTP 状态码:', response.status);
                console.log('API 原始响应:', responseData);
                console.groupEnd();
            }

            switch (response.status) {
                case 401:
                    userFriendlyError = `API Key 无效或认证失败 (401)：请在设置面板中检查您的 ${this.provider.name} API Key。`;
                    error.noRetry = true;
                    break;
                case 403:
                    userFriendlyError = `权限被拒绝 (403)：您的 API Key 无权访问所请求的资源，或您所在的地区不受支持。`;
                    error.noRetry = true;
                    break;
                case 429:
                    userFriendlyError = `请求频率过高 (429)：已超出 API 的速率限制，脚本将在稍后自动重试。`;
                    error.type = 'rate_limit';
                    break;
                case 500:
                case 503:
                    userFriendlyError = `服务器错误 (${response.status})：${this.provider.name} 的服务器暂时不可用，脚本将在稍后自动重试。`;
                    error.type = 'server_overloaded';
                    break;
                default:
                    userFriendlyError = `发生未知 API 错误 (代码: ${response.status})。`;
                    error.noRetry = true;
                    break;
            }

            error.message = userFriendlyError + `\n\n原始错误信息：\n${apiErrorMessage}`;
            return error;
        }

		/**
         * 主翻译方法，执行完整的异步网络请求和响应处理流程
         */
        translate(paragraphs, fromLang = 'auto', toLang = 'zh-CN') {
            return new Promise(async (resolve, reject) => {
                try {
                    const headers = await this._buildHeaders();
                    const body = this._buildBody(paragraphs, fromLang, toLang);
                    const url = this.provider.apiHost;

                    if (!url) {
                        const error = new Error(`服务 "${this.provider.name}" 未配置接口地址 (API Host)。`);
                        error.noRetry = true;
                        return reject(error);
                    }

                    if (DEBUG_MODE) {
                        console.groupCollapsed(`[调试日志] BaseApiClient.translate 准备发送请求`);
                        console.log('服务 Provider:', this.provider);
                        console.log('请求 URL:', url);
                        console.log('请求 Headers:', headers);
                        try {
                            console.log('请求 Body (解析后):', JSON.parse(body));
                        } catch (e) {
                            console.log('请求 Body (原始文本):', body);
                        }
                        console.groupEnd();
                    }

                    GM_xmlhttpRequest({
                        method: 'POST',
                        url: url,
                        headers: headers,
                        data: body,
                        responseType: 'text',
                        timeout: 45000,
                        onload: (res) => {
                            let responseData;
                            try {
                                responseData = JSON.parse(res.responseText);
                            } catch (e) {
                                if (DEBUG_MODE) {
                                    console.error(`[调试日志] JSON 解析失败。服务器返回的原始文本内容如下：`);
                                    console.log(res.responseText);
                                }
                                const error = new Error('API 响应不是有效的 JSON 格式。这可能由网络防火墙(WAF/CDN)拦截导致。');
                                error.type = 'invalid_json';
                                return reject(error);
                            }

                            if (res.status === 200) {
                                try {
                                    const translatedText = this._parseResponse(responseData);
                                    if (typeof translatedText !== 'string' || !translatedText.trim()) {
                                        return reject(new Error('API 未返回有效文本。'));
                                    }
                                    resolve(translatedText);
                                } catch (e) {
                                    reject(new Error(`解析响应失败: ${e.message}`));
                                }
                            } else {
                                reject(this._handleError(res, responseData));
                            }
                        },
                        onerror: () => reject({ type: 'network', message: '网络请求错误' }),
                        ontimeout: () => reject({ type: 'timeout', message: '请求超时' })
                    });
                } catch (error) {
                    reject(error);
                }
            });
        }
    }

	/**
     * 用于处理所有 OpenAI 兼容 API 的客户端，包括大部分自定义服务
     */
    class OpenAICompatibleClient extends BaseApiClient {
        /**
         * @param {object} provider - 包含所有配置的服务提供商对象
         */
        constructor(provider) {
            super(provider);
        }

        /**
         * 构建 OpenAI 兼容 API 的请求头
         */
        async _buildHeaders() {
            const { key: apiKey, index: keyIndex } = await _getApiKeyForService(this.provider);

            if (DEBUG_MODE) {
                const maskedKey = apiKey.length > 8 ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : apiKey;
                console.log(`[调试日志] OpenAICompatibleClient._buildHeaders:`);
                console.log(`  - 服务: ${this.provider.name}`);
                console.log(`  - 使用 Key #${keyIndex + 1}: ${maskedKey}`);
            }

            return {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            };
        }

        _buildBody(paragraphs, fromLang, toLang) {
            const fromLangName = LANG_CODE_TO_NAME[fromLang] || fromLang;
            const toLangName = LANG_CODE_TO_NAME[toLang] || toLang;
            const exampleOutput = generatePromptExample(toLang);
            const numberedText = paragraphs
                .map((p, i) => `${i + 1}. ${p.innerHTML}`)
                .join('\n\n');

            const defaultSystemPrompt = getSharedSystemPrompt();
            const systemPromptTemplate = GM_getValue('custom_ai_system_prompt', defaultSystemPrompt);
            const userPromptTemplate = GM_getValue('custom_ai_user_prompt', `Translate the following numbered list to {toLangName}:\n\n{numberedText}`);

            const finalSystemPrompt = systemPromptTemplate
                .replace(/\{fromLangName\}/g, fromLangName)
                .replace(/\{toLangName\}/g, toLangName)
                .replace(/\{exampleOutput\}/g, exampleOutput);

            const finalUserPrompt = userPromptTemplate
                .replace(/\{toLangName\}/g, toLangName)
                .replace(/\{numberedText\}/g, numberedText);

            const temperature = GM_getValue('custom_ai_temperature', 0);

            const requestData = {
                model: this.provider.selectedModel,
                messages: [
                    { "role": "system", "content": finalSystemPrompt },
                    { "role": "user", "content": finalUserPrompt }
                ],
                stream: false,
                temperature: temperature,
            };
            return JSON.stringify(requestData);
        }

        _parseResponse(response) {
            return getNestedProperty(response, 'choices[0].message.content');
        }

        /**
         * 处理 OpenAI 兼容 API 的特定错误
         */
        _handleError(response, responseData) {
            const handler = API_ERROR_HANDLERS[this.provider.id] || API_ERROR_HANDLERS['openai'] || super._handleError;

            if (DEBUG_MODE) {
                console.log(`[调试日志] OpenAICompatibleClient._handleError:`);
                console.log(`  - 服务: ${this.provider.name} (ID: ${this.provider.id})`);
                console.log(`  - 选定的错误处理器: ${handler.name || '基类处理器'}`);
            }

            return handler(response, this.provider.name, responseData);
        }

        /**
         * 覆盖基类的 translate 方法以添加详细的调试日志
         */
        translate(paragraphs, fromLang, toLang) {
            if (DEBUG_MODE) {
                console.group(`[调试日志] OpenAICompatibleClient.translate 发起请求`);
                console.log('服务 Provider:', this.provider);
                console.log('请求 URL:', this.provider.apiHost);
                console.log('请求模型:', this.provider.selectedModel);
                console.log('检测到的源语言:', fromLang);
                console.log('请求段落数:', paragraphs.length);
                console.groupEnd();
            }
            return super.translate(paragraphs, fromLang, toLang);
        }
    }

    /**
     * 根据 Provider 类型创建并返回相应的客户端实例
     */
    const ApiClientFactory = {
        /**
         * @param {object} provider - 包含所有配置的服务提供商对象
         * @returns {BaseApiClient} - 返回一个具体的 API 客户端实例
         */
        create: function(provider) {
            const clientType = provider.isCustom ? 'openai-compatible' : provider.id;

            switch (clientType) {
                case 'anthropic':
                    return new AnthropicClient(provider);
                case 'google_ai':
                    return new GoogleAIClient(provider);
                case 'openai':
                case 'zhipu_ai':
                case 'deepseek_ai':
                case 'groq_ai':
                case 'together_ai':
                case 'cerebras_ai':
                case 'modelscope_ai':
                case 'openai-compatible':
                    return new OpenAICompatibleClient(provider);
                default:
                    if (DEBUG_MODE) {
                        console.warn(`[ApiClientFactory] 未找到服务类型 "${clientType}" 的特定客户端，将回退到 OpenAI 兼容客户端。`);
                    }
                    return new OpenAICompatibleClient(provider);
            }
        }
    };

	/**
     * 用于处理 Anthropic API 的专属客户端
     */
    class AnthropicClient extends BaseApiClient {
        /**
         * @param {object} provider - 包含所有配置的服务提供商对象
         */
        constructor(provider) {
            super(provider);
        }

        /**
         * 构建符合 Anthropic API 规范的请求头
         */
        async _buildHeaders() {
            const { key: apiKey, index: keyIndex } = await _getApiKeyForService(this.provider);

            if (DEBUG_MODE) {
                const maskedKey = apiKey.length > 8 ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : apiKey;
                console.log(`[调试日志] AnthropicClient._buildHeaders:`);
                console.log(`  - 服务: ${this.provider.name}`);
                console.log(`  - 使用 Key #${keyIndex + 1}: ${maskedKey}`);
            }

            return {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            };
        }

        /**
         * 构建完全符合 Anthropic API 规范的请求体
         */
        _buildBody(paragraphs, fromLang, toLang) {
            const fromLangName = LANG_CODE_TO_NAME[fromLang] || fromLang;
            const toLangName = LANG_CODE_TO_NAME[toLang] || toLang;
            const exampleOutput = generatePromptExample(toLang);
            const numberedText = paragraphs
                .map((p, i) => `${i + 1}. ${p.innerHTML}`)
                .join('\n\n');

            const defaultSystemPrompt = getSharedSystemPrompt();
            const systemPromptTemplate = GM_getValue('custom_ai_system_prompt', defaultSystemPrompt);
            const userPromptTemplate = GM_getValue('custom_ai_user_prompt', `Translate the following numbered list to {toLangName}:\n\n{numberedText}`);

            const finalSystemPrompt = systemPromptTemplate
                .replace(/\{fromLangName\}/g, fromLangName)
                .replace(/\{toLangName\}/g, toLangName)
                .replace(/\{exampleOutput\}/g, exampleOutput);

            const finalUserPrompt = userPromptTemplate
                .replace(/\{toLangName\}/g, toLangName)
                .replace(/\{numberedText\}/g, numberedText);

            const temperature = GM_getValue('custom_ai_temperature', 0);

            const requestData = {
                model: this.provider.selectedModel,
                system: finalSystemPrompt,
                max_tokens: 4096,
                messages: [
                    {
                        "role": "user",
                        "content": finalUserPrompt
                    }
                ],
                temperature: temperature,
            };
            return JSON.stringify(requestData);
        }

        /**
         * 解析 Anthropic API 的响应
         */
        _parseResponse(response) {
            return getNestedProperty(response, 'content[0].text');
        }
    }

    /**
     * 用于处理 Gemini API 的专属客户端
     */
    class GoogleAIClient extends BaseApiClient {
        /**
         * @param {object} provider - 包含所有配置的服务提供商对象
         */
        constructor(provider) {
            super(provider);
        }

        /**
         * 构建符合 Gemini API 规范的请求头
         */
        _buildHeaders() {
            if (DEBUG_MODE) {
                console.log(`[调试日志] GoogleAIClient._buildHeaders:`);
                console.log(`  - 服务: ${this.provider.name}`);
                console.log(`  - Headers: Content-Type only`);
            }
            return {
                'Content-Type': 'application/json'
            };
        }

        /**
         * 构建符合 Gemini API 规范的请求体
         */
        _buildBody(paragraphs, fromLang, toLang) {
            const fromLangName = LANG_CODE_TO_NAME[fromLang] || fromLang;
            const toLangName = LANG_CODE_TO_NAME[toLang] || toLang;
            const exampleOutput = generatePromptExample(toLang);
            const numberedText = paragraphs
                .map((p, i) => `${i + 1}. ${p.innerHTML}`)
                .join('\n\n');

            const defaultSystemPrompt = getSharedSystemPrompt();
            const systemPromptTemplate = GM_getValue('custom_ai_system_prompt', defaultSystemPrompt);
            const userPromptTemplate = GM_getValue('custom_ai_user_prompt', `Translate the following numbered list to {toLangName}:\n\n{numberedText}`);

            const finalSystemPrompt = systemPromptTemplate
                .replace(/\{fromLangName\}/g, fromLangName)
                .replace(/\{toLangName\}/g, toLangName)
                .replace(/\{exampleOutput\}/g, exampleOutput);

            const finalUserPrompt = userPromptTemplate
                .replace(/\{toLangName\}/g, toLangName)
                .replace(/\{numberedText\}/g, numberedText);

            const temperature = GM_getValue('custom_ai_temperature', 0);

            const requestData = {
                systemInstruction: {
                    role: "user",
                    parts: [{ text: finalSystemPrompt }]
                },
                contents: [{
                    role: "user",
                    parts: [{ text: finalUserPrompt }]
                }],
                generationConfig: {
                    temperature: temperature,
                    candidateCount: 1,
                }
            };
            return JSON.stringify(requestData);
        }

        /**
         * 解析 Gemini API 的响应
         */
        _parseResponse(response) {
            return getNestedProperty(response, 'candidates[0].content.parts[0].text');
        }

        /**
         * 主翻译方法，处理 Google AI 特有的 URL 构建和认证逻辑
         */
        translate(paragraphs, fromLang, toLang) {
            return new Promise(async (resolve, reject) => {
                try {
                    const { key: apiKey, index: keyIndex } = await _getApiKeyForService(this.provider);
                    const modelId = this.provider.selectedModel;

                    if (!modelId) {
                        const error = new Error(`服务 "${this.provider.name}" 未选择任何模型。`);
                        error.noRetry = true;
                        return reject(error);
                    }

                    const finalUrl = this.provider.apiHost.replace('{model}', modelId) + `?key=${apiKey}`;
                    const headers = this._buildHeaders();
                    const body = this._buildBody(paragraphs, fromLang, toLang);

                    if (DEBUG_MODE) {
                        const maskedKey = apiKey.length > 8 ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : apiKey;
                        console.groupCollapsed(`[调试日志] GoogleAIClient.translate 准备发送请求`);
                        console.log('服务 Provider:', this.provider);
                        console.log('请求 URL:', finalUrl);
                        console.log(`使用 Key #${keyIndex + 1}: ${maskedKey}`);
                        console.log('检测到的源语言:', fromLang);
                        console.log('请求 Headers:', headers);
                        try {
                            console.log('请求 Body (解析后):', JSON.parse(body));
                        } catch (e) {
                            console.log('请求 Body (原始文本):', body);
                        }
                        console.groupEnd();
                    }

                    GM_xmlhttpRequest({
                        method: 'POST',
                        url: finalUrl,
                        headers: headers,
                        data: body,
                        responseType: 'text',
                        timeout: 45000,
                        onload: (res) => {
                            let responseData;
                            try {
                                responseData = JSON.parse(res.responseText);
                            } catch (e) {
                                if (DEBUG_MODE) {
                                    console.error(`[调试日志] JSON 解析失败。服务器返回的原始文本内容如下：`);
                                    console.log(res.responseText);
                                }
                                const error = new Error('API 响应不是有效的 JSON 格式。这可能由网络防火墙(WAF/CDN)拦截导致。');
                                error.type = 'invalid_json';
                                return reject(error);
                            }

                            if (res.status === 200) {
                                try {
                                    const translatedText = this._parseResponse(responseData);
                                    if (typeof translatedText !== 'string' || !translatedText.trim()) {
                                        return reject(new Error('API 未返回有效文本。'));
                                    }
                                    resolve(translatedText);
                                } catch (e) {
                                    reject(new Error(`解析响应失败: ${e.message}`));
                                }
                            } else {
                                reject(this._handleError(res, responseData));
                            }
                        },
                        onerror: () => reject({ type: 'network', message: '网络请求错误' }),
                        ontimeout: () => reject({ type: 'timeout', message: '请求超时' })
                    });
                } catch (error) {
                    reject(error);
                }
            });
        }
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
		if (storedEngine && (engineMenuConfig[storedEngine] || storedEngine.startsWith('custom_'))) {
			return storedEngine;
		}
		return CONFIG.transEngine;
	}

	/**
     * 使用百度翻译 API 检测文本语言
     */
    async function detectLanguageBaidu(text) {
        if (DEBUG_MODE) {
            console.log(`[语言检测] detectLanguageBaidu: 开始检测文本片段...`, { text: text.substring(0, 100) + '...' });
        }
        return new Promise((resolve) => {
            if (!text || !text.trim()) {
                if (DEBUG_MODE) {
                    console.log(`[语言检测] detectLanguageBaidu: 文本为空，默认返回 'en'。`);
                }
                resolve('en');
                return;
            }

            if (DEBUG_MODE) {
                console.log(`[语言检测] detectLanguageBaidu: 正在向百度 API 发送语言检测请求...`);
            }

            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://fanyi.baidu.com/langdetect',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                data: `query=${encodeURIComponent(text)}`,
                responseType: 'json',
                timeout: 10000,
                onload: function(response) {
                    if (DEBUG_MODE) {
                        console.log(`[语言检测] detectLanguageBaidu: 收到百度 API 响应。`, { status: response.status, response: response.response });
                    }
                    if (response.status === 200 && response.response && response.response.error === 0) {
                        const lang = response.response.lan;
                        if (DEBUG_MODE) {
                            console.log(`[语言检测] detectLanguageBaidu: 成功检测到语言 -> ${lang}`);
                        }
                        resolve(lang);
                    } else {
                        console.error('百度语言检测失败:', response.response ? response.response.msg : '请求失败');
                        if (DEBUG_MODE) {
                            console.log(`[语言检测] detectLanguageBaidu: 检测失败，默认返回 'en'。`);
                        }
                        resolve('en');
                    }
                },
                onerror: function(error) {
                    console.error('百度语言检测网络错误:', error);
                    if (DEBUG_MODE) {
                        console.log(`[语言检测] detectLanguageBaidu: 网络错误，默认返回 'en'。`);
                    }
                    resolve('en');
                },
                ontimeout: function() {
                    console.error('百度语言检测请求超时。');
                    if (DEBUG_MODE) {
                        console.log(`[语言检测] detectLanguageBaidu: 请求超时，默认返回 'en'。`);
                    }
                    resolve('en');
                }
            });
        });
    }

    /**
     * 远程翻译请求函数
     */
    async function requestRemoteTranslation(paragraphs, { retryCount = 0, maxRetries = 5, isCancelled = () => false, knownFromLang = null } = {}) {
        const createCancellationError = () => {
            const error = new Error('用户已取消翻译。');
            error.type = 'user_cancelled';
            error.noRetry = true;
            return error;
        };

        if (isCancelled()) {
            if (DEBUG_MODE) console.log(`[网络层] requestRemoteTranslation (尝试 #${retryCount + 1}) 入口检测到取消信号，立即中止。`);
            throw createCancellationError();
        }

        if (DEBUG_MODE) {
            console.log(`[网络层] requestRemoteTranslation 开始执行 (尝试 #${retryCount + 1})。`);
        }

        const engineName = getValidEngineName();
        const toLang = GM_getValue('to_lang', 'zh-CN');
        let fromLang;

        if (knownFromLang) {
            fromLang = knownFromLang;
            if (DEBUG_MODE) {
                console.log(`[网络层] 使用已知的源语言: '${fromLang}'，跳过自动检测。`);
            }
        } else {
            const userSelectedFromLang = GM_getValue('from_lang', 'auto');
            if (userSelectedFromLang === 'auto') {
                if (DEBUG_MODE) {
                    console.log(`[网络层] 用户设置为自动检测，开始执行语言检测...`);
                }
                const textToDetect = paragraphs.map(p => p.textContent).join(' ').substring(0, 200);
                fromLang = await detectLanguageBaidu(textToDetect);
            } else {
                fromLang = userSelectedFromLang;
                if (DEBUG_MODE) {
                    console.log(`[网络层] 用户已手动选择源语言: '${fromLang}'，跳过自动检测。`);
                }
            }
        }

        if (isCancelled()) {
            if (DEBUG_MODE) console.log('[网络层] 语言检测/设置读取后检测到取消信号，中止翻译。');
            throw createCancellationError();
        }

        if (engineName === 'google_translate') {
            try {
                const translatedHtmlSnippets = await _handleGoogleRequest(CONFIG.TRANS_ENGINES.google_translate, paragraphs, fromLang, toLang);
                if (!Array.isArray(translatedHtmlSnippets)) {
                    throw new Error('谷歌翻译接口未返回预期的数组格式');
                }
                const innerContents = translatedHtmlSnippets.map(html => {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = html;
                    return tempDiv.firstElementChild ? tempDiv.firstElementChild.innerHTML : '';
                });
                return innerContents.map((content, index) => `${index + 1}. ${content}`).join('\n\n');
            } catch (error) {
                console.error(`%c[网络层] 谷歌翻译错误:`, 'color: red;', error);
                throw error;
            }
        }

        try {
            const provider = getProviderById(engineName);
            if (!provider) {
                const error = new Error(`未能找到服务 "${engineName}" 的配置信息。`);
                error.noRetry = true;
                throw error;
            }

            const client = ApiClientFactory.create(provider);
            const translatedText = await client.translate(paragraphs, fromLang, toLang);

            if (typeof translatedText !== 'string' || !translatedText.trim()) {
                throw new Error('API 未返回有效文本。');
            }

            return translatedText;

        } catch (error) {
            if (isCancelled()) {
                if (DEBUG_MODE) console.log('[网络层] catch 块检测到取消信号，抛出取消错误。');
                throw createCancellationError();
            }

            if (DEBUG_MODE) {
                console.error(`%c[网络层] 错误: 在第 ${retryCount + 1} 次尝试中捕获到错误。`, 'color: red;', error);
            }

            const retriableErrorTypes = new Set([
                'server_overloaded',
                'rate_limit',
                'network',
                'timeout',
                'invalid_json'
            ]);

            const isRetriable = !error.noRetry && (retriableErrorTypes.has(error.type) || error.message.includes('API 未返回有效文本'));

            if (retryCount < maxRetries && isRetriable) {
                const delay = Math.pow(2, retryCount) * 1500 + Math.random() * 1000;
                if (DEBUG_MODE) {
                    console.log(`[网络层] 错误可重试 (类型: ${error.type || '未知'})。将在 ${Math.round(delay / 1000)} 秒后进行第 ${retryCount + 2} 次尝试... isCancelled 状态: ${isCancelled()}`);
                }
                await sleep(delay);

                if (isCancelled()) {
                    if (DEBUG_MODE) console.log('[网络层] 等待后检测到取消信号，中止重试。');
                    throw createCancellationError();
                }
                return await requestRemoteTranslation(paragraphs, { retryCount: retryCount + 1, maxRetries, isCancelled, knownFromLang });
            }
            throw error;
        }
    }

    /**
     * 为指定服务获取下一个可用的 API Key
     */
    async function _getApiKeyForService(provider) {
        const serviceId = provider.id;
        const arrayKey = `${serviceId}_keys_array`;
        const keys = GM_getValue(arrayKey, []);

        if (keys.length === 0) {
            const error = new Error(`请先在设置面板中为“${provider.name}”服务设置至少一个 API Key`);
            error.noRetry = true;
            throw error;
        }

        const lockKey = `${serviceId}_key_lock`;
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
            throw new Error(`获取 ${provider.name} API Key 的操作锁超时，请稍后重试。`);
        }

        try {
            const indexKey = `${serviceId}_key_index`;
            const startIndex = GM_getValue(indexKey, 0);
            const currentIndex = startIndex % keys.length;
            GM_setValue(indexKey, (startIndex + 1) % keys.length);

            const currentKey = keys[currentIndex];
            console.log(`[API Key 调度] 正在为“${provider.name}”服务使用 Key #${currentIndex + 1}`);
            return { key: currentKey, index: currentIndex };
        } finally {
            releaseLock();
        }
    }

	/**
     * 处理对谷歌翻译接口的特定请求流程
     */
    async function _handleGoogleRequest(engineConfig, paragraphs, fromLang, toLang) {
        await GoogleTranslateHelper .findAuth();
        if (!GoogleTranslateHelper .translateAuth) {
            throw new Error('无法获取谷歌翻译的授权凭证');
        }

        const headers = {
            ...engineConfig.headers,
            'X-goog-api-key': GoogleTranslateHelper .translateAuth
        };

        const sourceTexts = paragraphs.map(p => p.outerHTML);
        const requestData = JSON.stringify([
            [sourceTexts, fromLang, toLang], "te"
        ]);

        if (DEBUG_MODE) {
            console.groupCollapsed(`[调试日志] _handleGoogleRequest 准备发送请求`);
            console.log('请求 URL:', engineConfig.url_api);
            console.log('检测到的源语言:', fromLang);
            console.log('目标语言:', toLang);
            console.log('请求段落数:', paragraphs.length);
            console.groupEnd();
        }

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
                    userFriendlyError = `账户余额不足 (429)：您的 ${name} 账户已用尽信用点数或达到支出上限。请前往服务官网检查您的账单详情。`;
                    error.noRetry = true;
                    error.type = 'billing_error';
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
                if (apiErrorMessage && apiErrorMessage.includes('Slow Down')) {
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
                    error.message = `请求频率过高 (${businessErrorCode})：已超出 API 的速率限制，脚本将在稍后自动重试。\n\n原始错误信息：\n${apiErrorMessage}`;
                    return error;
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
            return new BaseApiClient({ name })._handleError(res, responseData);
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
                return new BaseApiClient({ name })._handleError(res, responseData);
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
                case 429:
                    userFriendlyError = `请求频率过高 (429)：已超出 API 的速率限制，脚本将在稍后自动重试。`;
                    error.type = 'rate_limit';
                    break;
                default:
                    return new BaseApiClient({ name })._handleError(res, res.response);
            }
        } else {
            userFriendlyError = `发生未知错误：${message}`;
            error.noRetry = (type !== 'network' && type !== 'timeout');
        }

        error.message = userFriendlyError + `\n\n原始错误信息：\n${message}`;
        return error;
    }

    /**
     * Together AI、Groq AI、Cerebras 的通用错误处理策略
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
                userFriendlyError = `请求内容过长 (${res.status})：发送的文本量超过了模型的上下文长度限制。请尝试翻译更短的文本段落。`;
                error.noRetry = true;
                break;
            case 404:
                userFriendlyError = `模型或接口地址不存在 (404)：您选择的模型名称可能已失效，或接口地址不正确。请尝试在设置面板中切换至其她模型或检查接口地址。`;
                error.noRetry = true;
                break;
            case 429:
                userFriendlyError = `请求频率过高 (429)：已超出 API 的速率限制，脚本将在稍后自动重试。`;
                error.type = 'rate_limit';
                break;
            case 500:
                userFriendlyError = `服务器内部错误 (500)：${name} 的服务器遇到问题，脚本将在稍后自动重试。`;
                error.type = 'server_overloaded';
                break;
            case 502:
                userFriendlyError = `网关错误 (502)：上游服务器响应无效。这通常是临时问题，脚本将自动重试。`;
                error.type = 'server_overloaded';
                break;
            case 503:
                userFriendlyError = `服务过载 (503)：${name} 的服务器当前流量过高，脚本将在稍后自动重试。`;
                error.type = 'server_overloaded';
                break;
            default:
                return new BaseApiClient({ name })._handleError(res, responseData);
        }

        error.message = userFriendlyError + `\n\n原始错误信息：\n${apiErrorMessage}`;
        return error;
    }

    /**
     * API 错误处理策略注册表
     */
    const API_ERROR_HANDLERS = {
        'openai': _handleOpenaiError,
        'anthropic': _handleAnthropicError,
        'zhipu_ai': _handleZhipuAiError,
        'deepseek_ai': _handleDeepseekAiError,
        'google_ai': _handleGoogleAiError,
        'groq_ai': _handleTogetherAiError,
        'together_ai': _handleTogetherAiError,
        'cerebras_ai': _handleTogetherAiError,
        'modelscope_ai': _handleTogetherAiError
    };

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

                if (DEBUG_MODE) {
                    console.log(`  - 原始HTML被分解为 ${htmlChunks.length} 个结构块:`, htmlChunks.map(c => c.cloneNode(true)));
                }

                let finalHTML = '';

                if (htmlChunks.length === 1) {
                    if (DEBUG_MODE) {
                        console.log(`  - 决策: 原文为单一结构块，将完整译文注入。`);
                    }
                    const singleChunk = htmlChunks[0];
                    replaceTextInNode(singleChunk, replacement);
                    finalHTML = singleChunk.nodeType === Node.ELEMENT_NODE ? singleChunk.outerHTML : singleChunk.nodeValue;
                    if (DEBUG_MODE) {
                        console.log(`  - 注入后的HTML:`, finalHTML);
                    }
                } else {
                    if (DEBUG_MODE) {
                        console.log(`  - 决策: 原文为多结构块，尝试拆分译文以匹配。`);
                    }
                    const separator = replacement.includes('·') || replacement.includes('・') ? /[·・]/ : /[\s-－﹣—–]+/;
                    const joinSeparator = replacement.includes('·') || replacement.includes('・') ? '·' : ' ';
                    const translationParts = replacement.split(separator);

                    if (DEBUG_MODE) {
                        console.log(`  - 译文被分解为 ${translationParts.length} 个部分 (使用分隔符 "${separator}"):`, translationParts);
                    }

                    if (htmlChunks.length === translationParts.length) {
                        if (DEBUG_MODE) {
                            console.log(`  - 验证通过：结构块数量与译文部分数量匹配。开始注入...`);
                        }
                        htmlChunks.forEach((chunk, index) => {
                            const part = translationParts[index];
                            if (DEBUG_MODE) {
                                console.log(`    - 注入部分 #${index + 1}: 将 "${part}" 注入到`, chunk.cloneNode(true));
                            }
                            replaceTextInNode(chunk, part);
                        });

                        finalHTML = htmlChunks.map(chunk => {
                            return chunk.nodeType === Node.ELEMENT_NODE ? chunk.outerHTML : chunk.nodeValue;
                        }).join(joinSeparator);
                        if (DEBUG_MODE) {
                            console.log(`  - 重组后的最终HTML:`, finalHTML);
                        }
                    } else {
                        if (DEBUG_MODE) {
                            console.warn(`  - [回退] HTML结构块数量 (${htmlChunks.length}) 与译文部分数量 (${translationParts.length}) 不匹配！`);
                            console.warn(`  - 执行安全回退：将完整译文注入，可能会丢失内部格式。`);
                        }
                        tempDiv.innerHTML = originalHTML;
                        tempDiv.textContent = replacement;
                        finalHTML = tempDiv.innerHTML;
                        if (DEBUG_MODE) {
                            console.log(`  - 回退生成的HTML:`, finalHTML);
                        }
                    }
                }
                processedText = processedText.replace(regex, finalHTML);

            } else {
                if (DEBUG_MODE) {
                    console.log(`  - (Regex策略) 直接替换为目标内容。`);
                }
                processedText = processedText.replace(regex, replacement);
            }
            if (DEBUG_MODE) {
                console.groupEnd();
            }
        }

        return applyPostTranslationReplacements(processedText);
    }

    /**
     * 段落翻译函数，集成了术语表、禁翻和后处理替换逻辑
     */
    async function translateParagraphs(paragraphs, { maxRetries = 3, isCancelled = () => false, knownFromLang = null } = {}) {
        const createCancellationError = () => {
            const error = new Error('用户已取消翻译。');
            error.type = 'user_cancelled';
            error.noRetry = true;
            return error;
        };

        if (isCancelled()) {
            if (DEBUG_MODE) console.log('translateParagraphs 入口检测到取消信号，立即中止。');
            throw createCancellationError();
        }

        if (DEBUG_MODE) console.log(`translateParagraphs 开始执行。isCancelled 初始状态: ${isCancelled()}`);

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
                    if (isCancelled()) throw createCancellationError();
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

                const combinedTranslation = await requestRemoteTranslation(preprocessedParagraphs, { retryCount: 0, maxRetries: 3, isCancelled, knownFromLang });

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
                if (isCancelled() || e.type === 'user_cancelled') {
                    if (DEBUG_MODE) console.log('catch 块检测到取消信号，抛出取消错误。');
                    throw createCancellationError();
                }

                if (DEBUG_MODE) {
                    console.error(`尝试 #${retryCount + 1} 失败:`, e);
                }

                if (e.noRetry) {
                    throw e;
                }

                if (retryCount < maxRetries) {
                    const delay = 500 * (retryCount + 1);
                    if (DEBUG_MODE) console.log(`准备进行第 ${retryCount + 2} 次重试，等待 ${delay}ms。isCancelled 状态: ${isCancelled()}`);
                    await sleep(delay);
                    if (isCancelled()) {
                        if (DEBUG_MODE) console.log('等待后检测到取消信号，中止重试。');
                        throw createCancellationError();
                    }
                    continue;
                }

                if (e.message.includes('分段数量不匹配') && paragraphs.length > 1) {
                    if (isCancelled()) throw createCancellationError();
                    if (DEBUG_MODE) {
                        console.warn('批量翻译失败，正在尝试逐段回退翻译...');
                    }
                    const fallbackResults = new Map();
                    for (const p of paragraphs) {
                        if (isCancelled()) {
                            if (DEBUG_MODE) console.log('逐段回退时检测到取消信号，中断回退。');
                            break;
                        }
                        const singleResultMap = await translateParagraphs([p], { maxRetries: 0, isCancelled, knownFromLang });
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

	/**
     * 创建并返回一个独立的翻译任务控制实例
     */
    function createTranslationController(options) {
        const { containerElement, buttonWrapper, originalButtonText, isLazyLoad } = options;

        const controller = {
            state: 'idle',
            translationTask: null,
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

                containerElement.querySelectorAll('[data-translation-state="translating"]').forEach(unit => {
                    delete unit.dataset.translationState;
                });

                this.state = 'running';
                this.isCancellationRequested = false;
                this.updateButtonState('翻译中…', 'state-running');

                const onComplete = () => {
                    if (!this.isCancellationRequested) {
                        this.state = 'complete';
                        this.updateButtonState('清除译文', 'state-complete');
                    }
                };

                const instanceState = {
                    elementState: new WeakMap(),
                    isFirstTranslationChunk: true,
                };

                if (isLazyLoad) {
                    this.translationTask = runTranslationEngineWithObserver({
                        containerElement: containerElement,
                        isCancelled: () => this.isCancellationRequested,
                        onProgress: (translated, total) => {
                            if (DEBUG_MODE) {
                                console.log(`[翻译进度] ${translated}/${total} 段已处理。`);
                            }
                        },
                        onComplete: onComplete,
                        instanceState: instanceState
                    });
                } else {
                    runTranslationEngineForBlock(containerElement, () => this.isCancellationRequested, onComplete);
                }
            },

            pause: function() {
                if (this.state !== 'running') return;

                this.isCancellationRequested = true;
                if (DEBUG_MODE) console.log('[UI控制] pause: 用户请求暂停，isCancellationRequested 设置为 true。');
                if (this.translationTask && this.translationTask.cleanup) {
                    this.translationTask.cleanup();
                    this.translationTask = null;
                }
                
                this.state = 'paused';
                this.updateButtonState('暂停中…', 'state-paused');
            },

            resume: function() {
                if (this.state !== 'paused') return;
                
                this.start();
            },

            clear: function() {
                this.isCancellationRequested = true;
                if (DEBUG_MODE) console.log('[UI控制] clear: 用户请求清除，isCancellationRequested 设置为 true。');
                if (this.translationTask && this.translationTask.cleanup) {
                    this.translationTask.cleanup();
                    this.translationTask = null;
                }

                const translationNodes = containerElement.querySelectorAll('.translated-by-ao3-script, .translated-by-ao3-script-error');
                translationNodes.forEach(node => node.remove());

                containerElement.querySelectorAll('[data-translation-state]').forEach(unit => {
                    unit.style.display = '';
                    delete unit.dataset.translationState;
                });
                
                this.state = 'idle';
                this.updateButtonState(originalButtonText, 'state-idle');
            },

            handleClick: function() {
                switch (this.state) {
                    case 'idle':
                        this.start();
                        break;
                    case 'running':
                        this.pause();
                        break;
                    case 'paused':
                        this.resume();
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

        allPotentialUnits = allPotentialUnits.filter(el => !el.closest('.translated-by-ao3-script, .translated-by-ao3-script-error'));

        if (allPotentialUnits.length === 0 && containerElement.textContent.trim() && !containerElement.querySelector(translatableSelectors)) {
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

        try {
            const translationResults = await translateParagraphs(units, { isCancelled });

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
                        newTranslatedElement.innerHTML = `翻译失败：${result.content.replace('翻译失败：', '')}`;
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
        } catch (error) {
            if (isCancelled() || (error && error.type === 'user_cancelled')) {
                units.forEach(unit => delete unit.dataset.translationState);
                return;
            }

            units.forEach(unit => {
                const transNode = document.createElement('div');
                transNode.className = 'translated-by-ao3-script-error';
                const newTranslatedElement = unit.cloneNode(false);
                newTranslatedElement.innerHTML = `翻译失败：${error.message || '未知错误'}`;
                transNode.appendChild(newTranslatedElement);
                transNode.style.cssText = 'margin-top: 0.25em; margin-bottom: 1em;';
                unit.after(transNode);
                unit.dataset.translationState = 'error';
            });

            if (onComplete) onComplete();
        }
    }

	/**
     * 翻译引擎（懒加载模式）
     */
    function runTranslationEngineWithObserver(options) {
        const { containerElement, isCancelled, onComplete, instanceState, onProgress = () => {} } = options;
        const { elementState } = instanceState;
        let isProcessing = false;
        const translationQueue = new Set();
        let scheduleTimeout = null;
        let flushTimeout = null;
        let detectedLanguageForSession = null;

        async function initializeLanguageDetection() {
            const userSelectedFromLang = GM_getValue('from_lang', 'auto');
            if (userSelectedFromLang === 'auto') {
                const firstFewUnits = allUnits.slice(0, 5);
                if (firstFewUnits.length > 0) {
                    const textToDetect = firstFewUnits.map(p => p.textContent).join(' ').substring(0, 200);
                    detectedLanguageForSession = await detectLanguageBaidu(textToDetect);
                    if (DEBUG_MODE) {
                        console.log(`[懒加载引擎] 任务初始化：自动检测到源语言为 '${detectedLanguageForSession}'。`);
                    }
                }
            } else {
                detectedLanguageForSession = userSelectedFromLang;
                if (DEBUG_MODE) {
                    console.log(`[懒加载引擎] 任务初始化：用户已设置源语言为 '${detectedLanguageForSession}'。`);
                }
            }
        }

        function preProcessAndGetUnits(container) {
            const brSplitSelectors = 'p, blockquote';
            const elementsToProcessForSplit = Array.from(container.querySelectorAll(brSplitSelectors))
                .filter(el => !el.closest('.translated-by-ao3-script, .translated-by-ao3-script-error'));

            const elementsToModify = [];
            elementsToProcessForSplit.forEach(el => {
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
            const userGeneratedUnits = allPotentialUnits.filter(el => !el.closest('.translated-by-ao3-script, .translated-by-ao3-script-error'));

            const skippableHeaders = ['Summary', 'Notes', 'Work Text', 'Chapter Text'];
            const candidateUnits = userGeneratedUnits.filter(p => !skippableHeaders.includes(p.textContent.trim()));

            const finalUnits = [];
            for (const unit of candidateUnits) {
                const nestedTranslatables = unit.querySelectorAll(translatableSelectors);
                const hasUserGeneratedNested = Array.from(nestedTranslatables).some(nested => !nested.closest('.translated-by-ao3-script, .translated-by-ao3-script-error'));

                if (!hasUserGeneratedNested) {
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

        initializeLanguageDetection();

        const isInViewport = (el) => {
            const rect = el.getBoundingClientRect();
            return (rect.top < window.innerHeight && rect.bottom >= 0);
        };

        const processQueue = async (forceFlush = false) => {
            if (isCancelled()) {
                if (DEBUG_MODE) console.log('[懒加载引擎] processQueue 检测到取消信号，终止处理。');
                return;
            }
            if (isProcessing || translationQueue.size === 0) return;

            clearTimeout(flushTimeout);

            const allQueuedUnits = [...translationQueue];
            if (allQueuedUnits.length === 0) return;

            const visibleInQueue = allQueuedUnits.filter(isInViewport);
            const offscreenInQueue = allQueuedUnits.filter(p => !visibleInQueue.includes(p));
            const prioritizedUnits = [...visibleInQueue, ...offscreenInQueue];

            const engineName = getValidEngineName();
            let paragraphLimit, chunkSize;

            if (engineName === 'google_translate') {
                const googleLimits = CONFIG.MODEL_SPECIFIC_LIMITS.google_translate;
                paragraphLimit = googleLimits.PARAGRAPH_LIMIT;
                chunkSize = googleLimits.CHUNK_SIZE;
            } else {
                chunkSize = GM_getValue('custom_ai_chunk_size', CONFIG.CHUNK_SIZE);
                paragraphLimit = GM_getValue('custom_ai_para_limit', CONFIG.PARAGRAPH_LIMIT);
            }

            if (DEBUG_MODE) {
                console.groupCollapsed(`[调试日志] 懒加载引擎参数`);
                console.log(`翻译服务: ${engineName}`);
                console.log(`段落数限制: ${paragraphLimit}`);
                console.log(`文本量限制: ${chunkSize}`);
                console.groupEnd();
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
            chunkToSend.forEach(p => {
                translationQueue.delete(p);
                p.dataset.translationState = 'translating';
            });

            if (DEBUG_MODE) {
                console.log(`[懒加载引擎] processQueue 开始处理 ${chunkToSend.length} 个段落。isCancelled 状态: ${isCancelled()}`);
            }

            try {
                const paragraphsToTranslate = chunkToSend.filter(p => p.tagName !== 'HR' && p.textContent.trim().length > 0);
                let translationResults;
                try {
                    translationResults = paragraphsToTranslate.length > 0 ? await translateParagraphs(paragraphsToTranslate, { isCancelled, knownFromLang: detectedLanguageForSession }) : new Map();
                } catch (error) {
                    if (error.type === 'user_cancelled') {
                        if (DEBUG_MODE) console.log('[懒加载引擎] processQueue 捕获到用户取消错误，提前返回。');
                        chunkToSend.forEach(p => {
                            if (p.dataset.translationState === 'translating') delete p.dataset.translationState;
                        });
                        isProcessing = false;
                        return;
                    }
                    translationResults = new Map();
                    paragraphsToTranslate.forEach(unit => {
                        translationResults.set(unit, { status: 'error', content: error.message || '未知错误' });
                    });
                }

                if (isCancelled()) {
                    if (DEBUG_MODE) console.log('[懒加载引擎] processQueue 在翻译后检测到取消信号，终止渲染。');
                    chunkToSend.forEach(p => {
                        if (p.dataset.translationState === 'translating') {
                            delete p.dataset.translationState;
                        }
                    });
                    return;
                }

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
                onProgress(translatedUnits, totalUnits);

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
            if (DEBUG_MODE) console.log(`[懒加载引擎] scheduleProcessing: 安排在 300ms 后处理队列 (强制: ${force})。`);
            scheduleTimeout = setTimeout(() => processQueue(force), 300);
        };

        let effectiveRootMargin;
        const engineName = getValidEngineName();
        if (engineName === 'google_translate') {
            const googleLimits = CONFIG.MODEL_SPECIFIC_LIMITS.google_translate;
            effectiveRootMargin = googleLimits.LAZY_LOAD_ROOT_MARGIN;
        } else {
            effectiveRootMargin = GM_getValue('custom_ai_lazy_load_margin', CONFIG.LAZY_LOAD_ROOT_MARGIN);
        }

        if (DEBUG_MODE) {
            console.log(`[调试日志] 懒加载引擎 IntersectionObserver 使用的 rootMargin: "${effectiveRootMargin}"`);
        }

        const observer = new IntersectionObserver((entries) => {
            if (isCancelled()) return;
            let addedToQueue = false;
            entries.forEach(entry => {
                if (entry.isIntersecting && !entry.target.dataset.translationState) {
                    if (DEBUG_MODE) console.log('[懒加载引擎] IntersectionObserver: 元素进入视野，加入队列。', entry.target);
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

			const isGeneral = type.includes('GENERAL');
			const isForbidden = type.includes('FORBIDDEN');

			if (termSeparatorRegex.test(normalizedTerm)) {
				processMultiPartTerm(term, translation, type, isLocal, timestamp, source, originalTerm, false);
				return;
			}

			const forms = generateWordForms(normalizedTerm, { preserveCase: isForbidden, forceLowerCase: isGeneral });

			if (isLocal || !processedLocalKeys.has(normalizedTerm.toLowerCase())) {
				addRule({ termForms: forms, translation, type, isLocal, timestamp, source, originalTerm, isMultiPart: false, isGeneral: isGeneral });
				if (isLocal) {
					forms.forEach(f => processedLocalKeys.add(f.toLowerCase()));
				}
			}
		}

		function processMultiPartTerm(term, translation, type, isLocal, timestamp, source, originalTerm, isFromEqualsSyntax) {
			const normalizedTerm = term.trim();
			const isForbidden = type.includes('FORBIDDEN');
			const normalizedTranslation = !isForbidden ? translation.trim() : null;

			if (!normalizedTerm || (!normalizedTranslation && !isForbidden)) return;

			const termParts = normalizedTerm.split(termSeparatorRegex);
			if (termParts.length <= 1 && !isFromEqualsSyntax) {
				processSinglePartTerm(term, translation, type, isLocal, timestamp, source, originalTerm);
				return;
			}

			if (isLocal && processedLocalKeys.has(normalizedTerm.toLowerCase())) return;
			if (!isLocal && processedLocalKeys.has(normalizedTerm.toLowerCase())) return;

			const isGeneral = type.includes('GENERAL');
			const termPartsWithForms = termParts.map(part =>
				Array.from(generateWordForms(part, { preserveCase: isForbidden, forceLowerCase: isGeneral }))
			);

			const isUnorderedEligible = isFromEqualsSyntax && (type === 'LOCAL_TERM' || type === 'ONLINE_TERM');

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

			if (!isForbidden && isFromEqualsSyntax) {
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
                    processMultiPartTerm(multiPartMatch[1], multiPartMatch[2], 'LOCAL_TERM', true, 0, '本地术语', entry.trim(), true);
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
            Object.entries(g.multiPartTerms || {}).forEach(([k, v]) => processMultiPartTerm(k, v, 'ONLINE_TERM', false, timestamp, sourceName, `${k}=${v}`, true));
            Object.entries(g.multiPartGeneralTerms || {}).forEach(([k, v]) => processMultiPartTerm(k, v, 'ONLINE_GENERAL_TERM', false, timestamp, sourceName, `${k}=${v}`, true));
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
        const { preserveCase = false, forceLowerCase = false } = options;
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

        if (forceLowerCase) {
            const lowerCaseForms = new Set();
            forms.forEach(form => lowerCaseForms.add(form.toLowerCase()));
            return lowerCaseForms;
        }

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

        (function() {
            const modelKey = 'google_ai_model';
            const currentModel = GM_getValue(modelKey, null);
            if (!currentModel) return;

            const migrationMap = {
                'gemini-2.5-flash': 'gemini-flash-latest',
                'gemini-2.5-flash-lite': 'gemini-flash-lite-latest'
            };

            if (migrationMap[currentModel]) {
                GM_setValue(modelKey, migrationMap[currentModel]);
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

        if (pageType === 'users_stats') {
            translateStatsChart();
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
                    if (p2 && p3 === 'profile' && p4 === 'edit') return 'users_settings';
                    if (p2 && p3 === 'profile') return 'profile';
                    if (p2 && p3 === 'stats') return 'users_stats';
                    if (p2 && p3 === 'readings') return 'users_history';
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
                    if (document.querySelector('div#main.works-update')) return 'works_edit';
                    if (p2 === 'new') {
                        const searchParams = new URLSearchParams(window.location.search);
                        if (searchParams.get('import') === 'true') {
                            return 'works_import';
                        }
                        return 'works_new';
                    }
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
			'front_page': [
                { selector: '.latest.news .post.group > blockquote.userstuff', text: '翻译概述', above: false, isLazyLoad: false }
            ],
			'works_show': [
				{ selector: 'div.summary blockquote.userstuff', text: '翻译简介', above: false, isLazyLoad: false },
				{ selector: 'div.notes blockquote.userstuff', text: '翻译注释', above: false, isLazyLoad: false },
				{ selector: '#chapters > .userstuff', text: '翻译正文', above: true, isLazyLoad: true },
				{ selector: '#chapters > .chapter > .userstuff[role="article"]', text: '翻译正文', above: true, isLazyLoad: true },
				{ selector: 'li.comment > blockquote.userstuff', text: '翻译评论', above: false, isLazyLoad: false }
			],
			'works_chapters_show': [
				{ selector: 'div.summary blockquote.userstuff', text: '翻译简介', above: false, isLazyLoad: false },
				{ selector: 'div.notes blockquote.userstuff', text: '翻译注释', above: false, isLazyLoad: false },
				{ selector: '#chapters > .userstuff', text: '翻译正文', above: true, isLazyLoad: true },
				{ selector: '#chapters > .chapter > .userstuff[role="article"]', text: '翻译正文', above: true, isLazyLoad: true },
				{ selector: 'li.comment > blockquote.userstuff', text: '翻译评论', above: false, isLazyLoad: false }
			],
			'admin_posts_show': [
                { selector: 'div[role="article"] > .userstuff', text: '翻译动态', above: true, isLazyLoad: false },
				{ selector: 'li.comment > blockquote.userstuff', text: '翻译评论', above: false, isLazyLoad: false }
			],
            'admin_posts_index': [
                { selector: '.admin_posts-index div[role="article"] > .userstuff', text: '翻译动态', above: true, isLazyLoad: false }
            ],
            'dashboard': [
                { selector: '.latest.news .post.group > blockquote.userstuff', text: '翻译概述', above: false, isLazyLoad: false },
                { selector: '.random.readings .reading.work.blurb .userstuff.summary', text: '翻译简介', above: false, isLazyLoad: false }
            ],
            'users_history': [blurbSummaryConfig],
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
                    const isWorkTextSelector = target.selector.startsWith('#chapters');
                    if (isWorkTextSelector && element.closest('.notes, .end.notes, .bookmark, .summary')) return;
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