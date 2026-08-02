/* Love 21 language switcher: English + Traditional Chinese. */
(function () {
  "use strict";

  const STORAGE_KEY = "love21_language";
  const ZH = "zh-Hant";
  const language = localStorage.getItem(STORAGE_KEY) === ZH ? ZH : "en";
  let currentLanguage = language;
  let translating = false;

  const translations = {
    "Love 21 Foundation": "Love 21 基金會",
    "Administrative Data Dashboard": "行政資料儀表板",
    "About us | Love 21": "關於我們 | Love 21",
    "Activity Finder | Love 21": "活動搜尋 | Love 21",
    "Contact us | Love 21": "聯絡我們 | Love 21",
    "Contributor | Love 21": "貢獻者 | Love 21",
    "Just curious | Love 21": "隨便看看 | Love 21",
    "Explore | Love 21": "探索 | Love 21",
    "Family | Love 21": "家庭 | Love 21",
    "Give | Love 21": "捐款 | Love 21",
    "Opportunity Exchange | Love 21": "機會交流 | Love 21",
    "Learn | Love 21": "了解 Love 21 | Love 21",
    "Love 21 Profile": "Love 21 個人檔案",
    "Transparency | Love 21": "透明度 | Love 21",
    "Volunteer | Love 21": "義工 | Love 21",
    "Story · Love 21": "故事 · Love 21",
    "Love 21 Foundation — Admin Data Dashboard": "Love 21 基金會 — 行政資料儀表板",
    "Love 21": "Love 21",
    "Menu": "選單",
    "Home": "首頁",
    "Family": "家庭",
    "Contributor": "貢獻者",
    "Donor": "捐贈者",
    "Volunteer": "義工",
    "Company": "企業",
    "Just curious": "隨便看看",
    "About": "關於我們",
    "About us": "關於我們",
    "Contact": "聯絡我們",
    "Contact us": "聯絡我們",
    "Donations": "捐款",
    "Profile": "個人檔案",
    "Links": "連結",
    "Explore": "探索",
    "Visit": "到訪",
    "Language": "語言",
    "EN": "EN",
    "繁": "繁",
    "Love 21 · Hong Kong": "Love 21 · 香港",
    "Love 21 Foundation": "Love 21 基金會",
    "Classes and support in Hong Kong for kids and young people with Down syndrome, autism, and other neurodivergences.": "我們在香港為唐氏綜合症、自閉症及其他神經多樣性人士提供課堂與支援，服務兒童及年輕人。",
    "What are you looking for?": "你正在尋找甚麼？",
    "About Love 21": "關於 Love 21",
    "The story": "我們的故事",
    "Instagram": "Instagram",
    "Sound off": "關閉聲音",
    "Sound on": "開啟聲音",
    "Close": "關閉",
    "Quick question": "快速問題",
    "Choose one so we can send you to the right page. You can still give money from any of them.": "選擇一項，我們就能帶你前往合適的頁面。無論選擇哪一項，你仍然可以捐款。",
    "I want to book a class for my kid": "我想為孩子預約課堂",
    "I want to volunteer, give, or hire someone": "我想做義工、捐款或聘請人才",
    "I am just looking around": "我只是想隨便看看",
    "After this, a short walkthrough starts. You can skip it.": "接下來會開始簡短導覽，你可以選擇跳過。",
    "About us": "關於我們",
    "Registered Hong Kong charity. Sport, nutrition, and family support for people with Down syndrome, autism, and other neurodivergences — and for their families. Home base: San Po Kong.": "我們是香港註冊慈善機構，為唐氏綜合症、自閉症及其他神經多樣性人士及其家人提供運動、營養和家庭支援。基地位於新蒲崗。",
    "Our story": "我們的故事",
    "Sensory playground": "感官體驗遊樂場",
    "Programmes": "服務計劃",
    "Financial reports": "財務報告",
    "People & governance": "團隊與管治",
    "Instagram posts": "Instagram 貼文",
    "Scroll for who we are, what we run, and how you can join.": "向下滾動，了解我們是誰、提供甚麼服務，以及你可以如何參與。",
    "Who we are": "我們是誰",
    "We are Love 21 Foundation. The “21” points to the 21st chromosome: trisomy 21, which causes Down syndrome.": "我們是 Love 21 基金會。「21」代表第 21 對染色體；三染色體 21 是導致唐氏綜合症的原因。",
    "#Somuchability is the line we work from: build around what people can do. We want to change the narrative from disability to somuchability.": "#Somuchability 是我們工作的出發點：以每個人能做到的事情為核心。我們希望把社會對「殘疾」的看法，轉變為看見每個人的無限可能。",
    "What we do": "我們做甚麼",
    "Classes and community": "課堂與社區",
    "We provide sports, fitness, nutrition support (one-to-one dietitian work since 2021), cooking classes, parent sessions, and counselling.": "我們提供運動、健身、營養支援（自 2021 年起提供一對一營養師服務）、烹飪課程、家長小組及輔導。",
    "That means 500+ families, 800+ sessions a month, 90+ activity types, and over 1,000 volunteer hours a month. Registered members and families use the programmes free of charge.": "這代表每月服務超過 500 個家庭、舉辦 800 多節課堂、涵蓋 90 多種活動，並累積超過 1,000 小時義工服務。登記會員及其家人可免費參與服務計劃。",
    "What we aim for": "我們的目標",
    "A lasting model, not a one-off project": "建立持續的模式，而不是一次性的項目",
    "We want people with Down syndrome, autism, and other neurodivergences to have the same chance as anyone else to train, work, live more independently, and be seen for their ability.": "我們希望唐氏綜合症、自閉症及其他神經多樣性人士，和每一個人一樣，都有機會接受訓練、工作、更獨立地生活，並以能力被看見。",
    "That means supporting the whole family, cutting stigma by letting Hong Kong meet members face to face, and growing education and volunteering so those meetings happen more often.": "這意味著支援整個家庭，讓香港人與會員面對面接觸以減少標籤，並擴展教育及義工服務，讓這些交流更常發生。",
    "Hire from the community": "從社區聘請人才",
    "Freelance and member-led work": "自由工作與會員主導的工作",
    "Offices and partners can book Love 21 members for work: swim coaching, kitchen demos, art commissions, dance sessions, yoga, and similar member-led workshops.": "辦公室及合作夥伴可以聘請 Love 21 會員工作，例如游泳教練、廚藝示範、藝術委託、舞蹈課堂、瑜伽，以及其他由會員主導的工作坊。",
    "All you need to do is pick a person, choose a free slot, and send a request.": "你只需選擇合適的人選和空閒時段，再提交要求。",
    "See who you can hire": "查看可以聘請的人選",
    "Volunteering made simple": "簡單參與義工服務",
    "Volunteering tasks are split into in-person and async tasks. Async tasks are online, simple, and take very little time — some as short as 15 minutes.": "義工任務分為現場及非同步任務。非同步任務可在網上完成，簡單而且用時很短，有些只需 15 分鐘。",
    "That makes volunteering accessible to people who live far away or have limited time.": "這讓身處較遠地區或時間有限的人，也能輕鬆參與義工服務。",
    "Open volunteer tasks": "查看義工任務",
    "Headphones on": "戴上耳機",
    "Walk the park": "在公園中行走",
    "Play": "開始體驗",
    "Transparency should be easy to find, easy to read, and connected to the work it describes.": "透明度應該容易找到、容易閱讀，並且與它所呈現的工作直接連結。",
    "Love 21 Foundation is a registered charity under Section 88 of Hong Kong's Inland Revenue Ordinance. The official annual reports provide the source of truth for programme progress and financial stewardship.": "Love 21 基金會是根據香港《稅務條例》第 88 條註冊的慈善機構。正式年度報告是了解服務計劃進度及財務管理情況的可靠來源。",
    "2024–2025 published figures": "2024–2025 年已公布數字",
    "Income and expenditure, made visible.": "清楚呈現收入與支出。",
    "HKD, rounded to the nearest thousand in the annual report.": "金額以港元計算，並按年度報告四捨五入至最接近的千位數。",
    "Total income": "總收入",
    "Total expenditure": "總支出",
    "Unrestricted · 49%": "非限定用途 · 49%",
    "Restricted · 49%": "限定用途 · 49%",
    "Other · 2%": "其他 · 2%",
    "Programmes · 86%": "服務計劃 · 86%",
    "Fundraising · 8%": "籌款 · 8%",
    "Administration · 6%": "行政 · 6%",
    "Two-year comparison": "兩年比較",
    "Published totals": "已公布總額",
    "2023–24: HKD 8.25m revenue and HKD 6.54m expenditure. 2024–25: HKD 13.50m income and HKD 11.49m expenditure.": "2023–24 年收入 825 萬港元、支出 654 萬港元。2024–25 年收入 1,350 萬港元、支出 1,149 萬港元。",
    "Annual report": "年度報告",
    "Official PDF": "官方 PDF",
    "Our programmes": "我們的服務計劃",
    "Sport opens the door. Nutrition, family support, and community participation help change last.": "運動打開大門；營養、家庭支援及社區參與，讓改變得以延續。",
    "Sport": "運動",
    "Designed without limitations.": "不受限制地設計。",
    "A broad range of sport, strength, coordination, and mental health activities helps members build skill and confidence.": "多元化的運動、力量、協調及心理健康活動，幫助會員建立技能與自信。",
    "Find a sport activity": "尋找運動活動",
    "Nutrition": "營養",
    "Healthy change made practical.": "讓健康改變落實於生活。",
    "One-to-one guidance and cooking lessons help families build routines that work in everyday life.": "一對一指導及烹飪課程，幫助家庭建立適合日常生活的習慣。",
    "Find a nutrition activity": "尋找營養活動",
    "Support extends beyond the class.": "支援延伸至課堂以外。",
    "Parent-only sessions, counselling, and shared activities strengthen the network around each participant.": "家長專屬小組、輔導及共同活動，讓每位參加者身邊的支援網絡更穩固。",
    "Ask about family support": "查詢家庭支援",
    "CSR and community": "企業社會責任與社區",
    "Make ability visible.": "讓能力被看見。",
    "Corporate sessions and member-led experiences challenge assumptions and make inclusion tangible.": "企業活動及會員主導的體驗，挑戰固有想法，讓共融變得具體可見。",
    "Plan a partnership": "策劃合作",
    "Governance brings together people from different professional backgrounds who share a commitment to Hong Kong's neurodiverse community.": "管治團隊匯聚來自不同專業背景、同樣致力服務香港神經多樣性社群的人士。",
    "Board of Directors": "董事會",
    "Love 21 Foundation organisation chart · July 2026": "Love 21 基金會組織架構圖 · 2026 年 7 月",
    "Contact us": "聯絡我們",
    "Pinned posts": "置頂貼文",
    "Recent posts": "最新貼文",
    "Community in motion": "社區一起動起來",
    "Nutrition in practice": "把營養帶進生活",
    "Moving together": "一起動起來",
    "Follow Love 21 on Instagram": "在 Instagram 關注 Love 21",
    "Park walk": "公園漫步",
    "Exit": "離開",
    "Your bag: yellow, with a red 21 on the front": "你的目標袋子：黃色，正面有紅色 21",
    "Level 1 of 4": "第 1 關，共 4 關",
    "Level 1 · Crowd — walk through the people": "第 1 關 · 人群——穿過人群",
    "Headphones recommended": "建議戴上耳機",
    "WASD move · drag to look · Exit stays clickable (cursor on)": "使用 WASD 移動 · 拖曳以轉動視角 · 離開按鈕會保持可點擊（游標已開啟）",
    "Crowd": "人群",
    "Back": "返回",
    "Again": "再試一次",
    "San Po Kong, Hong Kong": "香港新蒲崗",
    "Love 21 Space · San Po Kong": "Love 21 Space · 新蒲崗",
    "© Love 21 · Code to Give 2026 demo": "© Love 21 · Code to Give 2026 示範版",
    "© Love 21 Foundation · Hackathon demo for Code to Give 2026": "© Love 21 基金會 · Code to Give 2026 黑客松示範版",
    "← Home": "← 返回首頁",
    "Classes": "課堂",
    "Filter by type, age, day, support need, and language. Full classes can go on a waitlist.": "按類型、年齡、日子、支援需要及語言篩選。名額已滿的課堂可以加入候補名單。",
    "Replay walkthrough": "重播導覽",
    "Goal": "目標",
    "Any": "任何",
    "Age": "年齡",
    "Child (6-12)": "兒童（6–12 歲）",
    "Teen (13-17)": "青少年（13–17 歲）",
    "Adult (18+)": "成人（18 歲以上）",
    "Day": "日子",
    "Weekday": "平日",
    "Saturday": "星期六",
    "Sunday": "星期日",
    "Support need": "支援需要",
    "Low sensory": "低感官刺激",
    "1:1 available": "提供一對一",
    "Group OK": "適合小組",
    "Language": "語言",
    "Cantonese": "廣東話",
    "English": "英文",
    "Bilingual": "雙語",
    "Loading activities…": "正在載入活動……",
    "No activities match these filters. Clear a filter or try another day.": "沒有活動符合這些篩選條件。清除一項篩選，或嘗試其他日子。",
    "Open Ability": "開啟 Ability",
    "Family overview": "家庭概覽",
    "Classes and support in San Po Kong, Hong Kong.": "在香港新蒲崗提供課堂與支援。",
    "Hong Kong": "香港",
    "Love 21 Space": "Love 21 Space（活動中心）",
    "Where money goes": "捐款用途",
    "We believe that every neurodiverse individual deserves an opportunity to reach their highest potential.": "我們相信，每一位神經多樣性人士都應該有機會發揮自己的最大潛能。",
    "Love 21 Space · 2/F, Trium Lab": "Love 21 Space（活動中心）· Trium Lab 2樓",
    "2/F, Trium Lab": "Trium Lab 2樓",
    "Love 21 Space · 2/F, Trium Lab, 21 Luk Hop Street, San Po Kong": "Love 21 Space（活動中心）地址：香港九龍新蒲崗六合街21號Trium Lab 2樓",
    "2/F, Trium Lab, 21 Luk Hop Street, San Po Kong, Kowloon": "香港九龍新蒲崗六合街21號Trium Lab 2樓",
    "21 Luk Hop Street, San Po Kong": "香港九龍新蒲崗六合街21號",
    "21 Luk Hop Street, San Po Kong, Kowloon": "香港九龍新蒲崗六合街21號",
    "21 Luk Hop Street": "六合街21號",
    "San Po Kong, Kowloon": "香港九龍新蒲崗",
    "info@love21foundation.com": "info@love21foundation.com",
    "Questions about classes, volunteering, gifts, or partnerships? Write us. We answer.": "對課堂、義工服務、捐款或合作有疑問？歡迎聯絡我們，我們會回覆。",
    "Send a message": "發送訊息",
    "Demo only. This form does not send real email yet.": "僅供示範。此表格目前不會真正發送電郵。",
    "Name": "姓名",
    "Email": "電郵",
    "Topic": "主題",
    "General enquiry": "一般查詢",
    "Join a programme": "參加服務計劃",
    "Donate / CSR": "捐款／企業社會責任",
    "Partnership": "合作",
    "Message": "訊息",
    "Send message": "發送訊息",
    "Direct contacts": "直接聯絡",
    "General": "一般查詢",
    "Partnerships": "合作事宜",
    "Jeff (Founder / CEO)": "Jeff（創辦人／行政總裁）",
    "Quick links": "快速連結",
    "Find a class": "尋找課堂",
    "Volunteer shifts": "義工班次",
    "Give monthly": "每月捐款",
    "Current needs": "目前需要",
    "Open Profile": "開啟個人檔案",
    "Visit us": "到訪我們",
    "Love 21 Space and the office share Trium Lab on Luk Hop Street.": "Love 21 Space 及辦公室均位於鹿合街的 Trium Lab。",
    "Location": "地點",
    "Office": "辦公室",
    "1102, 11/F, same building": "香港九龍新蒲崗六合街21號Trium Lab 11樓1102室",
    "Sport, nutrition, and support for Hong Kong’s Down syndrome, autistic, and neurodiverse community.": "為香港唐氏綜合症、自閉症及神經多樣性社群提供運動、營養及支援。",
    "Hire someone, or help for a bit": "聘請人才，或抽空幫忙",
    "Looking for a kids class? Use the Family page instead. This one is for volunteers and companies.": "想找兒童課堂？請前往家庭頁面。此頁面供義工及企業使用。",
    "See who you can hire": "查看可以聘請的人選",
    "People you can hire": "可以聘請的人選",
    "Swimming coach": "游泳教練",
    "Office or CSR warm-up · about 60 minutes · teams of 8–15": "辦公室或企業社會責任熱身活動 · 約 60 分鐘 · 8–15 人團隊",
    "Date and time": "日期與時間",
    "Choose a slot": "選擇時段",
    "Request Mei": "要求 Mei",
    "Kitchen demo": "廚藝示範",
    "Member-led cooking for 8–12 people · half day": "由會員帶領、8–12 人參與的烹飪活動 · 半天",
    "Request Jordan": "要求 Jordan",
    "Art / illustration": "藝術／插畫",
    "Prints, murals, or a short workshop": "版畫、壁畫或短期工作坊",
    "Request Sam": "要求 Sam",
    "Dance": "舞蹈",
    "Group dance session for a wellness afternoon": "健康下午的團體舞蹈活動",
    "Request Ava": "要求 Ava",
    "Yoga / calm room": "瑜伽／安靜房間",
    "Quiet yoga for an office group": "為辦公室團隊而設的安靜瑜伽",
    "Request Leo": "要求 Leo",
    "Race day / track": "比賽日／田徑場",
    "Track day support or race-weekend cheer package": "田徑日支援或比賽週末打氣套餐",
    "Request Kai": "要求 Kai",
    "Full marketplace": "完整市集",
    "Other things we need": "我們需要的其他支援",
    "Short tasks": "短期任務",
    "Volunteer tasks": "義工任務",
    "Short tasks anyone can pick up. Claim one that matches your skills and time.": "任何人都可以認領短期任務。選擇一項符合你技能和時間的任務。",
    "Remote ones are async. In-person ones have a date on the calendar.": "遙距任務屬於非同步任務；現場任務會列出日期。",
    "Loading tasks…": "正在載入任務……",
    "Open profile": "開啟個人檔案",
    "Pick a task": "選擇任務",
    "Each card is a short task. Some need a quick onboarding first — claim to get started.": "每張卡片代表一項短期任務。部分任務需要先完成簡短入門流程——認領後即可開始。",
    "Track your hours": "記錄你的服務時數",
    "Claimed and completed shifts show up on your profile, along with the points you earn.": "你認領並完成的班次會連同所獲積分一起顯示在個人檔案中。",
    "Back to Contributor": "返回貢獻者",
    "My hours": "我的服務時數",
    "Other paths": "其他路線",
    "Just looking": "隨便看看",
    "Have a look around": "到處看看",
    "Love 21 is in San Po Kong. They run classes for kids and young people with Down syndrome, autism, and other neurodivergences. You do not need an account to browse.": "Love 21 位於新蒲崗，為患有唐氏綜合症、自閉症及其他神經多樣性的兒童及年輕人提供課堂。瀏覽網站不需要帳戶。",
    "Go to About": "前往關於我們",
    "Example": "例子",
    "Alex Chen · first 25m freestyle": "Alex Chen · 首次完成 25 米自由式",
    "Signed off by Coach Pat": "由 Pat 教練確認",
    "Swim beginners at the San Po Kong pool": "在新蒲崗泳池參加游泳初班",
    "Family can keep it private or share it": "家庭可以選擇將資料保密或分享",
    "About the programmes": "關於服務計劃",
    "What's here": "這裡有甚麼",
    "Everything you can do on this site": "你可以在這個網站做的事",
    "Profile": "個人檔案",
    "Want to know more about us?": "想進一步了解我們？",
    "Giving": "捐款",
    "HKD 300 a month": "每月 300 港元",
    "About two coach-led sessions": "約兩節教練帶領的課堂",
    "Pool / venue costs": "泳池／場地費用",
    "Class printouts": "課堂講義",
    "Open the give page": "開啟捐款頁面",
    "Next": "下一步",
    "Pick a path when you are ready": "準備好後選擇你的路線",
    "Instagram": "Instagram",
    "Explore": "探索",
    "Hire people, or help out": "聘請人才，或提供幫助",
    "Tax calculator": "稅務計算器",
    "Rough guide only. Not IRD advice. Pick your marginal salaries-tax rate.": "僅供粗略參考，不構成稅務局意見。請選擇你的邊際薪俸稅率。",
    "Monthly gift (HKD)": "每月捐款（港元）",
    "Marginal tax rate": "邊際稅率",
    "What it funds": "捐款用途",
    "About 2 coach-led programme sessions per HKD 300.": "每捐款 300 港元，約可支持 2 節由教練帶領的服務計劃課堂。",
    "~74.6% goes to programmes (prototype figure).": "約 74.6% 用於服務計劃（原型數字）。",
    "PayMe": "PayMe",
    "Apple Pay": "Apple Pay",
    "Google Pay": "Google Pay",
    "Start HKD": "開始捐款",
    "monthly": "每月",
    "Specific records from gifts. Switch to the supporter demo in Profile to load live receipts from the API.": "這裡顯示具體捐款紀錄。請在個人檔案切換至支持者示範帳戶，以從 API 載入實時收據。",
    "Give": "捐款",
    "· Demo": "· 示範",
    "Your donation of HKD 300 allowed us to fund two coach-led swim sessions, cover lane fees, and print bilingual class sheets.": "你捐出的 300 港元，讓我們可以資助兩節教練帶領的游泳課堂、支付泳道費用，並印製雙語課堂講義。",
    "Your donation of HKD 500 allowed us to run two coach-led sport sessions, cover pool lane fees, and print bilingual class sheets for Sports programmes.": "你捐出的 500 港元，讓我們可以舉辦兩節教練帶領的運動課堂、支付泳道費用，並為運動服務計劃印製雙語課堂講義。",
    "Your donation of HKD 200 allowed us to cover coach transport and session materials for Nutrition programmes.": "你捐出的 200 港元，讓我們可以支付教練交通費及營養服務計劃的課堂物資。",
    "See all activity on Profile": "在個人檔案查看所有活動",
    "What we need right now": "我們目前需要甚麼",
    "Open requests for goods, CSR sessions, and help. Pick a specific need.": "正在徵集物資、企業社會責任活動及其他支援。請選擇一項具體需要。",
    "In-kind": "物資捐助",
    "Urgent": "急切需要",
    "10 pairs running shoes": "10 對跑步鞋",
    "Size 36-42 · for Saturday track block.": "尺碼 36–42 · 供星期六田徑活動使用。",
    "I can help": "我可以幫忙",
    "CSR": "企業社會責任",
    "Corporate": "企業",
    "Book a CSR kitchen session": "預約企業社會責任廚藝活動",
    "Team of 8-12 · half day · member-led cooking.": "8–12 人團隊 · 半天 · 由會員帶領烹飪。",
    "Book a CSR session": "預約企業社會責任活動",
    "Hire": "聘請",
    "Ability": "能力",
    "Hire a creator": "聘請創作者",
    "Member art, cooking demos, or race-day cheer packages.": "會員藝術、廚藝示範或比賽日打氣套餐。",
    "Enquire": "查詢",
    "Micro-task": "微任務",
    "Photo sorting backlog": "待處理的相片整理",
    "90 minutes · remote · feeds the social wall.": "90 分鐘 · 遙距 · 用於更新社交牆。",
    "See roles that fit me": "查看適合我的角色",
    "Example family": "示範家庭",
    "Family page": "家庭頁面",
    "Book a class for your family": "為家庭預約課堂",
    "This page is for parents and carers. We will walk through booking a class and who can see it.": "此頁面供家長及照顧者使用。我們會帶你了解如何預約課堂，以及誰可以查看相關資料。",
    "Example: Alex is 9 and needs a beginners swim lane on Saturday at the San Po Kong pool. Jamie and Chris both see the booking on the same profile.": "例子：Alex 今年 9 歲，需要在星期六於新蒲崗泳池參加初班游泳課。Jamie 和 Chris 都可以在同一個個人檔案看到預約。",
    "Browse classes": "瀏覽課堂",
    "Log in to see your own family": "登入以查看自己的家庭資料",
    "Open": "開啟",
    "Open class": "開放課堂",
    "Swim · beginners": "游泳 · 初班",
    "Swim beginners, Saturday 10:00 to 11:00, Love 21 Space pool. Two spots left.": "初班游泳課，星期六 10:00 至 11:00，Love 21 Space 泳池。尚餘 2 個名額。",
    "Sat 10:00–11:00 at Love 21 Space pool": "星期六 10:00–11:00，Love 21 Space 泳池",
    "For Alex Chen": "適合 Alex Chen",
    "2 spots left": "剩餘 2 個名額",
    "Book this class": "預約此課堂",
    "Example waitlist": "示範候補名單",
    "If a class is full": "課堂額滿時",
    "When a class is full you join a waitlist and get an email when a spot opens.": "課堂額滿後，你可以加入候補名單；有名額空出時，你會收到電郵通知。",
    "One-on-one nutrition": "一對一營養課",
    "In Cantonese": "以廣東話進行",
    "Alex is #4 on the waitlist": "Alex 在候補名單排名第 4",
    "Reminders go by email": "提醒會透過電郵發送",
    "See more classes": "查看更多課堂",
    "Example household": "示範家庭成員",
    "Shared family profile": "共享家庭個人檔案",
    "Who can see this household’s stuff": "誰可以查看這個家庭的資料",
    "Mom, dad, and helpers can all see the household's classes. Add people under Profile.": "媽媽、爸爸及協助者都可以查看家庭的課堂。請在個人檔案中新增成員。",
    "Jamie · mom": "Jamie · 媽媽",
    "Chris · dad": "Chris · 爸爸",
    "You can add a caregiver or helper": "你可以加入照顧者或協助者",
    "Add someone": "新增成員",
    "Role in household": "家庭角色",
    "Mom": "媽媽",
    "Dad": "爸爸",
    "Caregiver": "照顧者",
    "Helper": "協助者",
    "Child / member": "子女／會員",
    "Email (optional)": "電郵（選填）",
    "Add member": "新增成員",
    "Coming up (example)": "即將到來（示範）",
    "From the household calendar": "來自家庭日曆",
    "Sat · Swim beginners · booked": "星期六 · 游泳初班 · 已預約",
    "Last week · Cooking together · done": "上星期 · 一起煮食 · 已完成",
    "Nutrition · waitlist #4": "營養課 · 候補名單第 4 位",
    "Open calendar": "開啟日曆",
    "This page is not for volunteering or hiring. Use Contributor for that. You can still give monthly if you want.": "此頁面不供義工服務或聘請人才使用。如有需要，請前往貢獻者頁面。你仍然可以選擇每月捐款。",
    "Change role": "更改角色",
    "Give monthly": "每月捐款",
    "Check a rough tax estimate, then start a monthly gift. Payment buttons here are demo only.": "先查看粗略稅務估算，再開始每月捐款。這裡的付款按鈕僅供示範。",
    "What we achieved with your help": "你的支持帶來的成果",
    "Rough guide only. Not IRD advice. Pick your marginal salaries-tax rate.": "僅供粗略參考，不構成稅務局意見。請選擇你的邊際薪俸稅率。",
    "2%": "2%",
    "6%": "6%",
    "10%": "10%",
    "14%": "14%",
    "17% (standard)": "17%（標準稅率）",
    "Opportunity Exchange | Love 21": "機會交流 | Love 21",
    "How Love 21 works": "Love 21 如何運作",
    "A few quick choices, then we send you to a real next step.": "回答幾個簡單問題後，我們會帶你前往實際的下一步。",
    "Your profile": "你的個人檔案",
    "Loading…": "正在載入……",
    "Replay walkthrough": "重播導覽",
    "Preferences": "偏好設定",
    "Log out": "登出",
    "Log in": "登入",
    "Choose how we contact you about class changes.": "選擇我們通知你課堂變動的方式。",
    "Default": "預設",
    "Optional": "選填",
    "WhatsApp": "WhatsApp",
    "Demo accounts": "示範帳戶",
    "Switch demo account": "切換示範帳戶",
    "Not logged in": "未登入",
    "Jamie Chen · Mom (multi-role)": "Jamie Chen · 媽媽（多重角色）",
    "Chris Chen · Dad": "Chris Chen · 爸爸",
    "Alex Chen · Child": "Alex Chen · 子女",
    "Sam Wong · Donor + volunteer": "Sam Wong · 捐贈者＋義工",
    "Taylor Ng · Volunteer + donor": "Taylor Ng · 義工＋捐贈者",
    "Morgan Yip · Admin": "Morgan Yip · 管理員",
    "Journal": "日誌",
    "Calendar": "日曆",
    "Member management": "會員管理",
    "Quick actions": "快速操作",
    "My journals": "我的護照",
    "Choose your journey": "選擇你的旅程",
    "Each journal keeps a separate record of your activities and achievements.": "每本護照都會獨立記錄你的活動與成就。",
    "Family journal": "家庭日誌",
    "Our journey together": "我們一起走過的旅程",
    "Family activities, programmes, and milestones in one place.": "在同一處查看家庭活動、服務計劃及重要里程碑。",
    "Pages 01–02 of 04": "第 01–02 頁，共 04 頁",
    "Use the arrows to turn the pages": "使用箭頭翻頁",
    "Prev": "上一頁",
    "Classes, volunteer work, and paid donations for everyone in this household.": "這個家庭每位成員的課堂、義工服務及付費捐款。",
    "Class": "課堂",
    "Donation": "捐款",
    "Family members": "家庭成員",
    "Mom, dad, caregivers, and helpers share the same child records.": "媽媽、爸爸、照顧者及協助者可以共同查看子女的記錄。",
    "What you can do": "你可以做甚麼",
    "Actions match the roles on this profile.": "可執行的操作會配合此個人檔案的角色。",
    "No data": "沒有資料",
    "Upload data": "上載資料",
    "Export all (.xlsx)": "匯出全部（.xlsx）",
    "Activities": "活動",
    "People": "人士",
    "Donations": "捐款",
    "Visitors": "訪客",
    "WebPage Analytics": "網頁分析",
    "Data & uploads": "資料與上載",
    "Show": "顯示",
    "Upcoming": "即將舉行",
    "Past": "過去",
    "All": "全部",
    "Search": "搜尋",
    "Group": "群組",
    "All groups": "所有群組",
    "Category": "類別",
    "All categories": "所有類別",
    "From": "由",
    "To": "至",
    "Reset": "重設",
    "Reset filters": "重設篩選",
    "Export .xlsx": "匯出 .xlsx",
    "Activity sessions": "活動場次",
    "Session roster": "場次名單",
    "Select an activity session on the left to see who is enrolled, who is volunteering, and which Love 21 staff member is monitoring it.": "選擇左側的活動場次，以查看參加者、義工，以及負責監察的 Love 21 職員。",
    "Binary search — name (or surname)": "二元搜尋——姓名（或姓氏）",
    "Role": "角色",
    "All roles": "所有角色",
    "Administrative staff": "行政職員",
    "Participants": "參加者",
    "Other / unclassified": "其他／未分類",
    "Status": "狀態",
    "Active": "活躍",
    "Inactive (90+ days)": "不活躍（超過 90 天）",
    "People database": "人士資料庫",
    "Donation drives": "捐款活動",
    "Donors": "捐贈者",
    "Pick a donation drive to see everyone who gave to it. Click any donor to open their full profile.": "選擇一項捐款活動，以查看所有捐贈者。點擊任何捐贈者即可開啟完整個人檔案。",
    "Sort by": "排序方式",
    "Total raised": "籌得總額",
    "Number of donors": "捐贈者人數",
    "Most recent": "最近日期",
    "Name (A–Z)": "姓名（A–Z）",
    "Group by": "分組方式",
    "Month": "月份",
    "Year": "年份",
    "Period": "時期",
    "All time": "全部時間",
    "Visits over time": "一段時間內的訪客數",
    "Visitor types": "訪客類型",
    "Age groups": "年齡組別",
    "Table view": "表格檢視",
    "User Behaviors Dashboard": "用戶行為儀表板",
    "data collected via PostHog": "資料由 PostHog 收集",
    "Upload your data": "上載你的資料",
    "Load demo data": "載入示範資料",
    "Undo manual attendance edits": "復原手動出席編輯",
    "Clear all data": "清除所有資料",
    "Choose files…": "選擇檔案……",
    "Fetch & load": "擷取並載入",
    "What is loaded now": "目前已載入的資料",
    "Expected columns (extra columns are kept and shown too)": "預期欄位（額外欄位也會保留及顯示）",
    "Date": "日期",
    "Start Time": "開始時間",
    "End Time": "結束時間",
    "Location": "地點",
    "Staff": "職員",
    "Attended": "已出席",
    "Absent": "缺席",
    "Cancelled": "已取消",
    "Enrollments": "報名記錄",
    "Person": "人士",
    "Email": "電郵",
    "Phone": "電話",
    "Address": "地址",
    "Date of Birth": "出生日期",
    "Joined": "加入日期",
    "Last Online": "最後上線",
    "Emergency Contact": "緊急聯絡人",
    "Notes": "備註",
    "Donor": "捐贈者",
    "Amount": "金額",
    "Time": "時間",
    "Method": "方式",
    "Note": "備註",
    "User Type": "用戶類型",
    "Age Group": "年齡組別",
    "Visits": "訪問次數",
    "Source": "來源",
    "Region": "地區",
    "Continue": "繼續",
    "Continue on About": "在關於我們頁面繼續",
    "No tasks open right now.": "目前沒有開放的任務。",
    "Skills needed:": "所需技能：",
    "Cantonese reading": "廣東話閱讀",
    "basic photo sorting": "基本相片整理",
    "phone mic, English or Cantonese": "手機收音，懂英文或廣東話",
    "on-site sports help": "現場運動支援",
    "Points given:": "可獲積分：",
    "Proofread banquet flyers. Do anytime this week.": "校對宴會傳單。本星期內任何時間完成。",
    "Sort July hike photos. Async.": "整理七月遠足相片。可非同步完成。",
    "Record a few short cheers. Upload when ready.": "錄製幾段簡短打氣聲，準備好後上載。",
    "Help set tables before the banquet.": "在宴會前協助擺放枱桌。",
    "Hand out water at San Po Kong.": "在新蒲崗派發飲用水。",
    "Session buddy · swimming": "游泳課堂夥伴",
    "Help one swim lane. Onboarded volunteers only.": "協助一條泳道。只限已完成入門的義工。",
    "Date on claim": "認領時確認日期",
    "A member": "一位會員",
    "is booked into": "已報名參加",
    "Everyone on the household sees it on the same profile.": "家庭中的每個人都可以在同一個個人檔案看到這項資料。",
    "is on the waitlist for": "正在候補",
    "You get an email when a spot opens.": "有名額空出時，你會收到電郵通知。",
    "No classes booked yet. Browse open classes below to get started.": "目前尚未預約課堂。請從下方瀏覽開放課堂並開始。",
    "No one is on a waitlist right now": "目前沒有任何人正在候補",
    "Browse classes to join one": "瀏覽課堂以加入候補名單",
    "Waitlist": "候補名單",
    "Registered": "已報名",
    "Member": "會員",
    "Classes will not load. Run the local server, then refresh.": "課堂無法載入。請啟動本機伺服器後重新整理。",
    "No commitment yet — start one first": "目前尚未有承諾——請先開始一項活動。",
    "— browse and book real classes, join a waitlist, track a member's achievements.": "— 瀏覽及預約課堂、加入候補名單，以及追蹤會員的成就。",
    "— claim short async tasks or in-person shifts, earn points, redeem rewards.": "— 認領短期非同步任務或現場班次、賺取積分及兌換獎勵。",
    "— estimate tax relief, start a monthly gift, see what it funds.": "— 估算稅務寬減、開始每月捐款，以及查看捐款用途。",
    "— hire a Love 21 member for freelance or CSR work.": "— 聘請 Love 21 會員進行自由工作或企業社會責任活動。",
    "— one login covers every role, with a journal of your activity across all of them.": "— 一個登入帳戶涵蓋所有角色，並以日誌記錄你在各個角色下的活動。",
    "— see exactly where donations go, programme by programme.": "— 逐項查看捐款的實際用途。",
    "Remote · async": "遙距 · 非同步",
    "In person · dated": "現場 · 已列日期",
    "Claim": "認領",
    "Open tasks": "查看任務",
    "Cantonese flyer check": "廣東話傳單校對",
    "Proofread banquet flyers.": "校對宴會傳單。",
    "Skills needed: Cantonese reading": "所需技能：廣東話閱讀",
    "Points given: 20": "可獲積分：20",
    "Photo sort": "相片整理",
    "Voice cheers": "錄製打氣聲",
    "Kitchen prep · Saturday": "廚房準備 · 星期六",
    "Track day helper": "田徑日助手",
    "No data": "沒有資料",
    "No members yet.": "目前沒有家庭成員。",
    "Your waitlist": "你的候補名單",
    "No waitlist": "目前沒有候補項目",
    "Your household": "你的家庭",
    "No household yet": "目前尚未建立家庭資料",
    "Add family members from your Profile": "請從你的個人檔案新增家庭成員",
    "Coming up": "即將到來",
    "Nothing booked yet": "目前尚未預約任何項目",
    "Showing your family's classes": "正在顯示你家庭的課堂",
    "No claimed tasks yet. Claim one from Contributor or Volunteer.": "目前沒有已認領的任務。請從貢獻者或義工頁面認領任務。",
    "No activity yet. Use the actions above to get started.": "目前沒有活動記錄。使用上方操作開始吧。",
    "No classes, volunteer work, or donations on this day.": "這天沒有課堂、義工服務或捐款記錄。",
    "Tap a day to see classes, volunteer work, and donations.": "點擊某一天，以查看課堂、義工服務及捐款。",
    "You're not logged in": "你尚未登入",
    "Switch demo account": "切換示範帳戶",
    "Family member added. They share the child records.": "家庭成員已新增，他們可以共同查看子女記錄。",
    "Pick at least one role": "請至少選擇一個角色",
    "Roles updated": "角色已更新",
    "Redeemed": "已兌換",
    "No gift yet. Start one from Give": "目前沒有捐款。請從捐款頁面開始。",
    "Gift updated": "捐款已更新",
    "Add a short note before marking complete": "請先新增簡短備註，再標記為完成",
    "Request failed": "請求失敗",
    "Thanks. On the live site, staff reply within 48 hours.": "謝謝。在正式網站上，職員會於 48 小時內回覆。",
    "Log in to continue": "登入以繼續",
    "Log in so we can save this to your account.": "登入後，我們就可以將資料儲存到你的帳戶。",
    "Email or phone": "電郵或電話",
    "Password": "密碼",
    "Create an account": "建立帳戶",
    "New here?": "第一次來嗎？",
    "Already have an account?": "已經有帳戶？",
    "Something went wrong": "發生錯誤",
    "Can't reach Love 21 right now. Start the local server and try again.": "目前無法連接 Love 21。請啟動本機伺服器後再試。",
    "Failed to load": "載入失敗",
    "Admin dashboard": "管理員儀表板",
    "Offline": "離線",
    "Done": "完成",
    "Skip demo": "跳過示範",
    "Okay, you are done with the walkthrough.": "好的，你已完成導覽。",
    "Nice. Next step?": "很好。下一步呢？",
    "Hire someone, claim a short task, or start a monthly gift.": "聘請人才、認領短期任務，或開始每月捐款。",
    "Hire someone": "聘請人才",
    "Short task": "短期任務",
    "Date not set": "尚未設定日期",
    "Not recorded": "未有記錄",
    "Not added yet": "尚未新增",
    "Profile holder": "個人檔案持有人",
    "Our journey together": "我們一起走過的旅程",
    "Time given with purpose": "有意義地付出時間",
    "A record of your impact": "你的影響力記錄",
    "Keep taking part to earn your first badge.": "繼續參與，贏取你的第一枚徽章。",
    "Journal holder": "日誌持有人",
    "Member since": "會員始於",
    "Journal no.": "日誌編號",
    "Collected stamps": "收集到的印章",
    "Your badges": "你的徽章",
    "Badges are earned automatically from your real activity.": "徽章會根據你的實際活動自動獲得。",
    "Every activity adds another mark to your Love 21 story.": "每次活動都會為你的 Love 21 故事留下新的印記。",
    "Recent records": "最近記錄",
    "Latest entries": "最新項目",
    "Continued": "續篇",
    "More from your journey": "更多旅程記錄",
    "Wrong bag — look for yellow with red 21": "袋子不對——請尋找黃色、帶有紅色 21 的袋子",
    "Bag highlighted — press E or click to pick it up": "袋子已標示——按 E 或點擊即可拾取",
    "Walk closer to the yellow bag with red 21": "走近帶有紅色 21 的黃色袋子",
    "Pick": "拾取",
    "Level 2 · Haze": "第 2 關 · 霧霾",
    "Level 3 · Dodging": "第 3 關 · 閃避",
    "Level 4 · Find your bag": "第 4 關 · 找到你的袋子",
    "Dodge": "閃避",
    "Find bag": "尋找袋子",
    "View post on Instagram": "在 Instagram 查看貼文",
    "Net cost after deduction": "扣稅後的實際成本",
    "You give": "你的捐款",
    "tax relief about": "稅務寬減約",
    "Start onboarding": "開始入門流程",
    "Claimed. Run the local API to save it on your profile.": "已認領。請啟動本機 API，將它儲存到你的個人檔案。",
    "Mark complete": "標記為完成",
    "What did you do?": "你做了甚麼？",
    "Open": "開放",
    "Done": "已完成",
    "No gift yet. Start one from Give": "目前沒有捐款。請從捐款頁面開始。"
  };

  const attributeTranslations = {
    "Close": "關閉",
    "Open this post on Instagram.": "在 Instagram 開啟這篇貼文。",
    "Love 21 members, families, volunteers, and staff together": "Love 21 會員、家庭、義工及職員一起參與",
    "Love 21 Foundation organisation chart · July 2026": "Love 21 基金會組織架構圖 · 2026 年 7 月",
    "What did you do?": "你做了甚麼？",
    "Search donation drives": "搜尋捐款活動",
    "click a slice to cross-filter": "點擊圖表區塊以交叉篩選",
    "hover a bar for exact counts": "將滑鼠移到柱狀圖上查看準確數字",
    "drag to brush a range · click a bar to focus it · double-click to drill into its days": "拖曳以選取範圍 · 點擊柱狀圖聚焦 · 雙擊以深入查看每日數據"
  };

  const textSources = new WeakMap();
  const attributeSources = new WeakMap();
  const attributes = ["aria-label", "aria-placeholder", "placeholder", "title", "alt", "data-tour-title", "data-tour-text", "data-demo"];

  function normalize(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function translated(value) {
    const source = normalize(value);
    return currentLanguage === ZH && translations[source] ? translations[source] : source;
  }

  function preserveWhitespace(raw, replacement) {
    const leading = String(raw).match(/^\s*/)[0];
    const trailing = String(raw).match(/\s*$/)[0];
    return leading + replacement + trailing;
  }

  function shouldSkipText(node) {
    const parent = node.parentElement;
    return !parent || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|SVG|TITLE)$/i.test(parent.tagName);
  }

  function translateTextNode(node) {
    if (shouldSkipText(node)) return;
    const raw = node.nodeValue;
    const source = textSources.has(node) ? textSources.get(node) : normalize(raw);
    if (!source) return;
    textSources.set(node, source);
    const next = currentLanguage === ZH && translations[source] ? translations[source] : source;
    if (normalize(raw) !== next) node.nodeValue = preserveWhitespace(raw, next);
  }

  function translateAttributes(element) {
    if (!element || element.nodeType !== 1) return;
    attributes.forEach(function (name) {
      if (!element.hasAttribute(name)) return;
      let sources = attributeSources.get(element);
      if (!sources) {
        sources = {};
        attributeSources.set(element, sources);
      }
      if (!Object.prototype.hasOwnProperty.call(sources, name)) {
        sources[name] = element.getAttribute(name);
      }
      const source = sources[name];
      const next = currentLanguage === ZH && attributeTranslations[source]
        ? attributeTranslations[source]
        : (currentLanguage === ZH && translations[normalize(source)] ? translations[normalize(source)] : source);
      if (element.getAttribute(name) !== next) element.setAttribute(name, next);
    });
  }

  function translateTree(root) {
    const base = root && root.nodeType === 1 ? root : document.documentElement;
    translateAttributes(base);
    const elements = base.querySelectorAll ? base.querySelectorAll("*") : [];
    elements.forEach(translateAttributes);
    const walker = document.createTreeWalker(base, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) translateTextNode(node);
  }

  function injectLanguageSwitchers() {
    document.querySelectorAll(".site-nav [data-language-switcher]").forEach(function (switcher) {
      const item = switcher.closest(".nav-language-item");
      (item || switcher).remove();
    });
    document.querySelectorAll(".site-footer").forEach(function (footer) {
      const target = footer.querySelector(".footer-bottom") || footer;
      if (target.querySelector("[data-language-switcher]")) return;
      const wrap = document.createElement("div");
      wrap.className = "footer-language";
      wrap.setAttribute("data-language-switcher", "");
      wrap.setAttribute("aria-label", "Language");
      wrap.innerHTML =
        '<span class="footer-language-label">Language</span>' +
        '<button type="button" class="footer-language-button" data-language-choice="en" aria-pressed="false">EN</button>' +
        '<span aria-hidden="true">/</span>' +
        '<button type="button" class="footer-language-button" data-language-choice="zh-Hant" aria-pressed="false">繁</button>';
      const copyright = target.firstElementChild;
      if (copyright && copyright.nextSibling) {
        target.insertBefore(wrap, copyright.nextSibling);
      } else {
        target.appendChild(wrap);
      }
    });
  }

  function updateLanguageSwitchers() {
    document.querySelectorAll("[data-language-switcher]").forEach(function (switcher) {
      switcher.querySelectorAll("[data-language-choice]").forEach(function (button) {
        button.setAttribute("aria-pressed", button.getAttribute("data-language-choice") === currentLanguage ? "true" : "false");
      });
    });
  }

  function applyLanguage() {
    if (translating) return;
    translating = true;
    document.documentElement.lang = currentLanguage === ZH ? "zh-Hant" : "en";
    const titleSource = document.documentElement.getAttribute("data-title-source") || document.title;
    document.documentElement.setAttribute("data-title-source", titleSource);
    document.title = currentLanguage === ZH && translations[normalize(titleSource)]
      ? translations[normalize(titleSource)]
      : titleSource;
    injectLanguageSwitchers();
    translateTree(document.documentElement);
    updateLanguageSwitchers();
    document.dispatchEvent(new CustomEvent("love21:languagechange", {
      detail: { language: currentLanguage }
    }));
    translating = false;
  }

  document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-language-choice]");
    if (!button) return;
    event.preventDefault();
    currentLanguage = button.getAttribute("data-language-choice") === ZH ? ZH : "en";
    localStorage.setItem(STORAGE_KEY, currentLanguage);
    applyLanguage();
  });

  const observer = new MutationObserver(function (mutations) {
    if (translating || currentLanguage !== ZH) return;
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType === 1) translateTree(node);
      });
    });
    injectLanguageSwitchers();
    updateLanguageSwitchers();
  });

  window.Love21I18n = {
    getLanguage: function () { return currentLanguage; },
    setLanguage: function (next) {
      currentLanguage = next === ZH ? ZH : "en";
      localStorage.setItem(STORAGE_KEY, currentLanguage);
      applyLanguage();
    },
    translate: function (value) { return translated(value); }
  };

  applyLanguage();
  observer.observe(document.body, { childList: true, subtree: true });
})();
