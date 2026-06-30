// src/lib/notifications/marketing/library.ts
//
// FoodKnock Notification Engine — Marketing Notification Library.
//
// ── VOICE REWRITE IN PROGRESS — STATUS ───────────────────────────────────
// FoodKnock's marketing copy is being rewritten slot-by-slot into a
// distinctive, screenshot-worthy voice — micro-jokes, relationship/Gen-Z
// humor, Hinglish wit — rather than generic "Order now, fresh food"
// copy. This is a large, deliberately incremental rewrite (the full scope
// spans 1000+ entries across every slot), done in per-slot batches so each
// batch can be reviewed and verified (no duplicate IDs, no repeated joke
// mechanism/punchline/structure, valid category/priority values) before
// the next one lands.
//
//   ✅ REWRITTEN: lunch (58 entries, lunch_01–lunch_58)
//   ⏳ ORIGINAL VOICE, AWAITING REWRITE: every other slot below
//
// Slots not yet rewritten still use the original "Aaj ka lunch sorted?"
// style placeholder-free, production-valid copy from the prior phase —
// they are fully functional, just not yet upgraded to the new voice.
//
// ── VOICE GUIDE FOR FUTURE BATCHES ───────────────────────────────────────
// Every notification should feel like a text from a witty friend, not a
// company. Rotate emotional tone between consecutive entries (funny →
// cute → curiosity → relationship → self-roast → wholesome → FOMO →
// back to funny). No two entries should share the same joke mechanism or
// punchline structure, even with different words. CTA labels should match
// the specific joke, not default to a generic "Order Now" — that's exactly
// the kind of template-filling this rewrite exists to eliminate.
//
// ── CATEGORY MAPPING — flagged, not hidden ───────────────────────────────
// Several slots map to a preference category by judgment call, since
// Notification Settings (Part 6) only has ~10 toggles and this library has
// ~30 content slots:
//   - weekend/sunday/rain/cold_weather/summer  → "offer"   (closest fit;
//     situational promotional nudges, same spirit as a generic offer)
//   - festival_*                                → "festival"
//   - birthday/loyalty/reward/referral          → "reward"
//   - menu_*/new_menu/best_seller/combo          → "offer"
//   - comeback_user/inactive_user/review_reminder → "general" (ungated) —
//     these are retention/lifecycle nudges, not discount marketing; gating
//     them as aggressively as a promo would undercut their purpose.
//   - abandoned_cart                             → "offer"
// If a finer-grained toggle set is ever wanted, extend NotificationCategory
// and NOTIFICATION_PREFERENCE_* in preferences.ts — this file's `category`
// values would just need updating to match, nothing else.

import type { MarketingNotificationTemplate } from "./types";

export const MARKETING_LIBRARY: MarketingNotificationTemplate[] = [
    // ── Morning ──────────────────────────────────────────────────────────
    { id: "morning_01", slot: "morning", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Explore Menu",
      title: "☀️ Good morning, foodie!", body: "Naya din, nayi cravings. Dekho kya khaas hai aaj FoodKnock pe." },
    { id: "morning_02", slot: "morning", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🌅 Uth gaye? Order bhi kar do!", body: "Subah subah kuch garma garam — bas ek tap door hai." },
    { id: "morning_03", slot: "morning", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "😴 Neend khuli, bhook bhi!", body: "FoodKnock pe subah ka first order — thoda extra fast jaata hai 😉" },

    // ── Breakfast ────────────────────────────────────────────────────────
    { id: "breakfast_01", slot: "breakfast", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Breakfast",
      title: "🥐 Breakfast banaane ka mann nahi?", body: "Hum bana dete hain. Fresh sandwiches aur shakes ready hain." },
    { id: "breakfast_02", slot: "breakfast", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Explore Menu",
      title: "☕ Chai ke saath kya chalega?", body: "Crispy sandwich ya garma garam paratha — FoodKnock decide karwa dega." },
    { id: "breakfast_03", slot: "breakfast", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🍳 Subah ka sabse important meal", body: "Skip mat karo — 2 taps mein breakfast door pe." },

    // ── Lunch ────────────────────────────────────────────────────────────
    { id: "lunch_01", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Order Lunch",
      title: "Tumhara tiffin kahaan hai?", body: "Yahin hai. FoodKnock mein. Bas order karna padega 🥹" },
    { id: "lunch_02", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Restart Me",
      title: "Laptop ka battery 1%", body: "Tumhara energy bhi. Lunch on karo, restart karo." },
    { id: "lunch_03", slot: "lunch", category: "lunch_deal", priority: "high", url: "/menu", ctaLabel: "No Seen-Zone Here",
      title: "Crush ne seen kiya, reply nahi kiya?", body: "Lunch kabhi seen-zone mein nahi rakhta. Order karo." },
    { id: "lunch_04", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Sort My Lunch",
      title: "Pata hai sabse mushkil decision kya hota hai?", body: "12 baje 'aaj kya khaaun' sochna. Hum easy bana dete hain." },
    { id: "lunch_05", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Order Lunch",
      title: "'Lunch ke baad baat karte hain' bola meeting mein?", body: "Toh lunch pehle sort karo. Order karo." },
    { id: "lunch_06", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Let's Eat",
      title: "Background music laga lo 🎬", body: "Kyunki lunch order karne ka moment bhi heroic hota hai." },
    { id: "lunch_07", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Treat Yourself",
      title: "Lunch break ko thoda VIP feel do", body: "Aaj kuch aalishan order karo. Khud ko izzat do." },
    { id: "lunch_08", slot: "lunch", category: "lunch_deal", priority: "high", url: "/menu", ctaLabel: "That's Me",
      title: "Office ka sabse bhooka insaan kaun hai?", body: "Tum, abhi. Order karne mein der mat karo." },
    { id: "lunch_09", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "I'm In",
      title: "Budget tight hai", body: "Bhook tight nahi hai. Affordable lunch options dekh lo." },
    { id: "lunch_10", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Take The Break",
      title: "Khud ko bhi thoda time do", body: "Lunch break sirf khaane ka nahi, saans lene ka bhi hota hai." },
    { id: "lunch_11", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Get Ready",
      title: "Kisi ne pucha 'lunch mein kya hai'?", body: "Tumhara jawab ready hona chahiye. Order kar lo pehle." },
    { id: "lunch_12", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Caught Out",
      title: "WFH ka sabse bada lie", body: "'Main kitchen mein hi hoon, bana lunga.' Teen ghante ho gaye. Order kar lo." },
    { id: "lunch_13", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Try Someone Reliable",
      title: "Aaj kisi ne tumhe ignore kiya?", body: "Lunch kabhi ignore nahi karta. Wahi try karo." },
    { id: "lunch_14", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Settle This",
      title: "Mama ne pucha 'khaaya?'", body: "Abhi nahi, par order karne wale hain. Sach bol diya na?" },
    { id: "lunch_15", slot: "lunch", category: "lunch_deal", priority: "high", url: "/menu", ctaLabel: "Fix This",
      title: "12:01 PM. Officially lunch crisis declared.", body: "FoodKnock se sambhal lo, jaldi." },
    { id: "lunch_16", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Fine, You Got Me",
      title: "Haan, ye ek notification hai.", body: "Par sach mein, lunch order kar lo. Bhook lagi hai na?" },
    { id: "lunch_17", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Earn It",
      title: "Gym gaye the?", body: "Toh protein chahiye. Lunch mein wahi milega, guilt nahi." },
    { id: "lunch_18", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Bring It Back",
      title: "College canteen yaad aata hai?", body: "Wo vibe nahi milegi, par swaad milega. Order karo." },
    { id: "lunch_19", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Lunch Never Ghosts",
      title: "BF ya GF reply nahi karta time pe?", body: "Lunch hamesha time pe aata hai. Priority sahi rakho." },
    { id: "lunch_20", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Let Us Handle It",
      title: "Thoda thaka hua lag rahe ho", body: "Lunch break lo. Order kar do, hum sambhal lete hain." },
    { id: "lunch_21", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Beat Him To It",
      title: "Sharma ji ka beta already order kar chuka hai.", body: "Tum kab karoge?" },
    { id: "lunch_22", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Give Lunch Its Due",
      title: "Dinner ko hamesha zyada pyaar milta hai", body: "Lunch bhi haqdar hai. Order karo, balance banao." },
    { id: "lunch_23", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Listen To It",
      title: "AC mein baithe baithe bhi pet bol raha hai", body: "Lunch ka time hai. Suno usko." },
    { id: "lunch_24", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Tick It Off",
      title: "To-do list mein 'lunch' likha tha?", body: "Toh tick mark karo. Order kar do." },
    { id: "lunch_25", slot: "lunch", category: "lunch_deal", priority: "high", url: "/menu", ctaLabel: "Catch Up",
      title: "Colleagues already order kar chuke hain.", body: "Tum peeche reh jaaoge kya?" },
    { id: "lunch_26", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Feed Me",
      title: "Bhook lagi hai.", body: "Hum jaante hain. Order kar do." },
    { id: "lunch_27", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Fix My Monday",
      title: "Monday hai, mood nahi hai", body: "Lunch sahi ho toh sab sahi lagta hai. Order karo." },
    { id: "lunch_28", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Try This Instead",
      title: "Fridge khola, kuch nahi mila.", body: "FoodKnock khola, sab mil gaya." },
    { id: "lunch_29", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "You Caught That",
      title: "Ye notification bhi tumhe pata hai ignore nahi karoge", body: "Kyunki bhook waqai lagi hai. Order karo." },
    { id: "lunch_30", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Trust Lunch",
      title: "Pyaar mein dhokha mil sakta hai", body: "Lunch mein nahi. Order karo, bharosa rakho." },
    { id: "lunch_31", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Connect The Dots",
      title: "12 baje. Bhook. Tum. FoodKnock.", body: "Connect the dots. Order karo." },
    { id: "lunch_32", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Promise Kept",
      title: "Apne aap se ek promise karo", body: "'Aaj lunch skip nahi karunga.' Order karo, promise rakho." },
    { id: "lunch_33", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Improve My Mood",
      title: "Fact: bhooka insaan zyada irritate hota hai.", body: "Solution: lunch order karo, mood theek karo." },
    { id: "lunch_34", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Cheat Day",
      title: "Diet plan? Kal se.", body: "Aaj lunch order karo, kal ki tension kal lenge." },
    { id: "lunch_35", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Still Within Budget",
      title: "Salary abhi door hai", body: "Par affordable lunch options abhi available hain. Order karo." },
    { id: "lunch_36", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Got It, Ordering",
      title: "Lunch ka time ho gaya", body: "Bas itna hi kehna tha. Order kar lo." },
    { id: "lunch_37", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Count Me In",
      title: "Single ho ya committed, bhook sabko lagti hai", body: "Equal opportunity cravings. Order karo." },
    { id: "lunch_38", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Both Happy",
      title: "Mama bolengi 'bahar ka khana mat khao'", body: "Hum bolte hain, fresh banaya hai. Dono khush." },
    { id: "lunch_39", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Skip The Line",
      title: "Office cafeteria mein line lambi hai?", body: "FoodKnock pe koi line nahi. Order karo." },
    { id: "lunch_40", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Give It Its Due",
      title: "Lunch sabse underrated meal hai", body: "Sab dinner ko credit dete hain. Aaj lunch ko uska haq do." },
    { id: "lunch_41", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Exactly That",
      title: "Kuch garam, kuch tasty, kuch turant", body: "Yahi chahiye na abhi? Order karo." },
    { id: "lunch_42", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Window's Open",
      title: "Intermittent fasting kar rahe the?", body: "Window khatam. Lunch order karne ka time aa gaya." },
    { id: "lunch_43", slot: "lunch", category: "lunch_deal", priority: "high", url: "/menu", ctaLabel: "Right Now",
      title: "Bhook 100%. Patience 0%.", body: "Order karo, abhi." },
    { id: "lunch_44", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "No Judgement",
      title: "Kabhi kabhi sirf comfort food chahiye hota hai", body: "Judgement zero. Order karo." },
    { id: "lunch_45", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Pick Mine",
      title: "Tumhara 'type' kya hai?", body: "Spicy, cheesy, ya simple? FoodKnock mein sab milta hai." },
    { id: "lunch_46", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Join The List",
      title: "Guess karo aaj kitne logo ne lunch order kiya FoodKnock pe", body: "Tum bhi list mein ho sakte ho. Order karo." },
    { id: "lunch_47", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Save Time",
      title: "'Quick call' jo 1 ghanta chal gayi", body: "Ab lunch bhi quick order kar lo. Time bacha lo." },
    { id: "lunch_48", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Be A Green Flag",
      title: "Lunch skip karna ek red flag hai", body: "Apne aap ko green flag bano. Order karo." },
    { id: "lunch_49", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Good Company Either Way",
      title: "Akela lunch kar rahe ho?", body: "Company nahi hai toh kya, swaad toh hai. Order karo." },
    { id: "lunch_50", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Same Mood, Always",
      title: "Bahar garmi ho ya thand", body: "Bhook ka mood hamesha same rehta hai. Order karo." },
    { id: "lunch_51", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Relax",
      title: "Tension mat lo", body: "Lunch sort hai. Bas order karna baaki hai." },
    { id: "lunch_52", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Checkout Now",
      title: "Cart mein add kiya, checkout nahi kiya?", body: "Wo Amazon ke liye theek hai. Lunch ke liye abhi order karo." },
    { id: "lunch_53", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Pause Scrolling",
      title: "Reels dekh rahe ho bhooke pet?", body: "Wo baad mein. Pehle lunch order karo." },
    { id: "lunch_54", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Decide For Me",
      title: "1 baja, 14 unread messages, ek bhi lunch decide nahi kar raha", body: "Hum kar dete hain. Order karo." },
    { id: "lunch_55", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "No Overthinking",
      title: "Itna mat socho", body: "Bas order kar do. Hum baaki sambhal lete hain." },
    { id: "lunch_56", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "One Less Decision",
      title: "Aaj kaam zyada hai", body: "Toh decision-making kam rakho. Order kar do, soch mat." },
    { id: "lunch_57", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Start Today",
      title: "Naya resolution: lunch kabhi miss nahi karna", body: "Day 1 abhi shuru karo. Order karo." },
    { id: "lunch_58", slot: "lunch", category: "lunch_deal", priority: "normal", url: "/menu", ctaLabel: "Lunch First",
      title: "Power nap ya lunch?", body: "Dono ek saath nahi ho sakte. Lunch pehle, nap baad mein." },

    // ── Tea Time ─────────────────────────────────────────────────────────
    { id: "tea_time_01", slot: "tea_time", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Snacks",
      title: "🧋 4 baje ka break ban gaya?", body: "Chai ke saath kuch crispy chahiye? FoodKnock pe order karo." },
    { id: "tea_time_02", slot: "tea_time", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "☕ Tea time, snack crime!", body: "Samosa ho ya sandwich — FoodKnock deliver karega, guilt nahi." },
    { id: "tea_time_03", slot: "tea_time", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🍪 Thoda break le lo", body: "Evening snacks fresh hain aur ready hain. Order karo, relax karo." },

    // ── Evening ──────────────────────────────────────────────────────────
    { id: "evening_01", slot: "evening", category: "evening_deal", priority: "normal", url: "/menu", ctaLabel: "Explore Menu",
      title: "🌆 Shaam ho gayi, mood badal gaya?", body: "Kuch chatpata khaane ka time hai. Dekho kya naya hai." },
    { id: "evening_02", slot: "evening", category: "evening_deal", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "✨ Evening plans? Food sorted!", body: "Jo bhi karo, khaana FoodKnock se order karo — fast aur fresh." },
    { id: "evening_03", slot: "evening", category: "evening_deal", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🍟 Shaam ki bhook alag hoti hai", body: "Fries, shake, ya kuch garam-garam — bas batao, hum deliver karenge." },

    // ── Dinner ───────────────────────────────────────────────────────────
    { id: "dinner_01", slot: "dinner", category: "evening_deal", priority: "normal", url: "/menu", ctaLabel: "Order Dinner",
      title: "🌙 Dinner ka plan ban gaya?", body: "Nahi bana toh bana do — FoodKnock pe full menu ready hai." },
    { id: "dinner_02", slot: "dinner", category: "evening_deal", priority: "normal", url: "/menu", ctaLabel: "Explore Menu",
      title: "🍽️ Raat ka khaana sorted karna hai?", body: "Pizza se lekar momos tak — sab kuch ek hi jagah." },
    { id: "dinner_03", slot: "dinner", category: "evening_deal", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "😋 Aaj kitchen band, FoodKnock on!", body: "Khana banane ka mood nahi? Hum bana ke bhej dete hain." },

    // ── Late Night ───────────────────────────────────────────────────────
    { id: "late_night_01", slot: "late_night", category: "evening_deal", priority: "low", url: "/menu", ctaLabel: "Order Now",
      title: "🌃 Raat ko bhook lag gayi?", body: "Hum jaag rahe hain. Late night cravings sorted, FoodKnock pe." },
    { id: "late_night_02", slot: "late_night", category: "evening_deal", priority: "low", url: "/menu", ctaLabel: "Order Now",
      title: "🦉 Neend nahi aa rahi, bhook lag rahi hai?", body: "Kuch order kar lo — hum tab tak deliver kar dete hain." },
    { id: "late_night_03", slot: "late_night", category: "evening_deal", priority: "low", url: "/menu", ctaLabel: "Order Now",
      title: "🌙 12 baj gaye but bhook nahi sui", body: "Late night menu ready hai. Order karo, guilt baad mein." },

    // ── Weekend ──────────────────────────────────────────────────────────
    { id: "weekend_01", slot: "weekend", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🎉 Weekend aa gaya, kitchen ki chhutti!", body: "Aaj khaana hum banayenge, tum sirf enjoy karo." },
    { id: "weekend_02", slot: "weekend", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Explore Menu",
      title: "🛋️ Saturday mode: ON. Cooking mode: OFF.", body: "FoodKnock se order karo, baaki sab relax karo." },
    { id: "weekend_03", slot: "weekend", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "✨ Weekend vibes need weekend food", body: "Kuch special order karo — aaj ke din rules nahi hote." },

    // ── Sunday ───────────────────────────────────────────────────────────
    { id: "sunday_01", slot: "sunday", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "☀️ Sunday Funday, food ready!", body: "Lazy Sunday ke liye perfect combo — order karo, relax karo." },
    { id: "sunday_02", slot: "sunday", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🥱 Sunday brunch ya Sunday lunch?", body: "Jo bhi ho, FoodKnock pe milega. Bas decide karo." },
    { id: "sunday_03", slot: "sunday", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "📺 Sunday = Netflix + Food", body: "Pehla part sorted hai tumhare paas, doosra hum kar dete hain." },

    // ── Rain ─────────────────────────────────────────────────────────────
    { id: "rain_01", slot: "rain", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🌧️ Baarish ho rahi hai bahar?", body: "Andar raho, garma garam order karo. Rain or shine, hum deliver karte hain." },
    { id: "rain_02", slot: "rain", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "☔ Mausam ka mood, momos ka time!", body: "Baarish mein bahar jaane ka mann nahi? Hum aa jaayenge." },
    { id: "rain_03", slot: "rain", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🌦️ Pakode wala mood hai?", body: "Crispy snacks ready hain — bas order karo, baaki hum dekhte hain." },

    // ── Cold Weather ─────────────────────────────────────────────────────
    { id: "cold_weather_01", slot: "cold_weather", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🥶 Thand lag rahi hai?", body: "Garma garam soup ya shake — jo chahiye, FoodKnock laayega." },
    { id: "cold_weather_02", slot: "cold_weather", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "❄️ Winter ka best combo: blanket + FoodKnock", body: "Bahar mat jao, order karo. Hum already raste mein." },
    { id: "cold_weather_03", slot: "cold_weather", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Explore Menu",
      title: "🧣 Sweater pehno, order bhi kar do", body: "Cold weather, warm food. Dekho kya khaas hai aaj." },

    // ── Summer ───────────────────────────────────────────────────────────
    { id: "summer_01", slot: "summer", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "☀️ Garmi mein cooking? Bilkul nahi.", body: "Cold shake, fresh juice — order karo, kitchen door rakho." },
    { id: "summer_02", slot: "summer", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🍦 Garmi ka asli sukoon: ice cream", body: "FoodKnock pe ready hai — bas ek tap, thandi shaanti." },
    { id: "summer_03", slot: "summer", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🥤 Garmi zyada, mood kam?", body: "Chilled drinks aur light bites — sab kuch FoodKnock pe." },

    // ── Festival: Diwali ─────────────────────────────────────────────────
    { id: "festival_diwali_01", slot: "festival_diwali", category: "festival", priority: "high", url: "/menu", ctaLabel: "View Offer",
      title: "🪔 Diwali aa gayi, mithai kam nahi padni chahiye!", body: "Festive specials ready hain — order karo, celebrate karo." },
    { id: "festival_diwali_02", slot: "festival_diwali", category: "festival", priority: "high", url: "/menu", ctaLabel: "Explore Menu",
      title: "✨ Roshni ka tyohaar, khushiyon ka khaana", body: "Diwali specials ready hain — apno ke saath enjoy karo." },
    { id: "festival_diwali_03", slot: "festival_diwali", category: "festival", priority: "high", url: "/menu", ctaLabel: "Order Now",
      title: "🎆 Iss Diwali, kitchen ki chhutti karo", body: "Hum sambhal lete hain khaana, tum lights aur pataake." },

    // ── Festival: Holi ───────────────────────────────────────────────────
    { id: "festival_holi_01", slot: "festival_holi", category: "festival", priority: "high", url: "/menu", ctaLabel: "Try Festive Menu",
      title: "🎨 Holi hai! Rang ke saath swaad bhi.", body: "Gujiya se lekar thandai tak — festive menu try karo." },
    { id: "festival_holi_02", slot: "festival_holi", category: "festival", priority: "high", url: "/menu", ctaLabel: "Order Now",
      title: "🌈 Colors outside, cravings inside?", body: "FoodKnock delivers — rang lagao, khaana hum laayenge." },
    { id: "festival_holi_03", slot: "festival_holi", category: "festival", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "💦 Holi khel ke bhook lag gayi?", body: "Freshen up karo, order karo — hum ready hain." },

    // ── Festival: Independence Day ───────────────────────────────────────
    { id: "festival_independence_day_01", slot: "festival_independence_day", category: "festival", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🇮🇳 Happy Independence Day!", body: "Aaj ka din special hai — FoodKnock pe bhi kuch special try karo." },
    { id: "festival_independence_day_02", slot: "festival_independence_day", category: "festival", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🎉 Azaadi ka jashn, swaad ke saath", body: "Order karo, deshbhakti ke saath dawat bhi." },
    { id: "festival_independence_day_03", slot: "festival_independence_day", category: "festival", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🪁 15 August, full masti", body: "Khaana hum pe leave karo, baaki plans pe focus karo." },

    // ── Festival: Republic Day ───────────────────────────────────────────
    { id: "festival_republic_day_01", slot: "festival_republic_day", category: "festival", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🇮🇳 Happy Republic Day!", body: "Chhutti hai toh khaana bhi special hona chahiye." },
    { id: "festival_republic_day_02", slot: "festival_republic_day", category: "festival", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🎖️ 26 January, special feeling", body: "Order karo aur din ko thoda aur special banao." },
    { id: "festival_republic_day_03", slot: "festival_republic_day", category: "festival", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🪁 Republic Day chill mode", body: "Ghar pe relax karo, khaana hum bhej dete hain." },

    // ── Festival: Raksha Bandhan ─────────────────────────────────────────
    { id: "festival_raksha_bandhan_01", slot: "festival_raksha_bandhan", category: "festival", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🎀 Raksha Bandhan ki shubhkaamnaye!", body: "Bhai-behen ka din special hai — saath mein khaana bhi order karo." },
    { id: "festival_raksha_bandhan_02", slot: "festival_raksha_bandhan", category: "festival", priority: "normal", url: "/menu", ctaLabel: "Order Combo",
      title: "💝 Rakhi bandhi, ab dawat ki baari", body: "Combo order karo, sabko khush karo." },
    { id: "festival_raksha_bandhan_03", slot: "festival_raksha_bandhan", category: "festival", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "👫 Family time = food time", body: "Raksha Bandhan special menu try karo, FoodKnock se." },

    // ── Festival: Valentine's Day ────────────────────────────────────────
    { id: "festival_valentine_01", slot: "festival_valentine", category: "festival", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "💕 Valentine's Day hai aaj!", body: "Special kisi ke saath, special khaana FoodKnock se order karo." },
    { id: "festival_valentine_02", slot: "festival_valentine", category: "festival", priority: "normal", url: "/menu", ctaLabel: "Plan Dinner",
      title: "🌹 Pyaar ka izhaar, swaad ke saath", body: "Romantic dinner plan karo — hum delivery sambhal lete hain." },
    { id: "festival_valentine_03", slot: "festival_valentine", category: "festival", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "😍 Date plan ho gaya, khaana bhi ho jaaye?", body: "Order karo, baaki sab perfect ho jaayega." },

    // ── Birthday ─────────────────────────────────────────────────────────
    { id: "birthday_01", slot: "birthday", category: "reward", priority: "high", url: "/menu", ctaLabel: "Treat Yourself",
      title: "🎂 Happy Birthday se aapko!", body: "Aaj ka din khaas hai — FoodKnock se treat yourself karo." },
    { id: "birthday_02", slot: "birthday", category: "reward", priority: "high", url: "/menu", ctaLabel: "Order Now",
      title: "🎉 Aapka special din, hamara special offer", body: "Birthday ke din, kuch toh order karna banta hai!" },
    { id: "birthday_03", slot: "birthday", category: "reward", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🥳 Saal mein ek din toh apne liye!", body: "FoodKnock pe order karo, khud ko gift karo." },

    // ── Offer ────────────────────────────────────────────────────────────
    { id: "offer_01", slot: "offer", category: "offer", priority: "high", url: "/menu", ctaLabel: "View Offer",
      title: "🔥 Limited time offer, bhaago!", body: "FoodKnock pe abhi deal live hai — miss mat karo." },
    { id: "offer_02", slot: "offer", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Claim Offer",
      title: "💸 Aaj ka special discount", body: "Order karo aur paise bachao — offer abhi available hai." },
    { id: "offer_03", slot: "offer", category: "flash_sale", priority: "urgent", url: "/menu", ctaLabel: "View Offer",
      title: "⏰ Offer khatam hone wala hai!", body: "Jaldi karo, ye deal zyada der nahi rukegi." },

    // ── Combo ────────────────────────────────────────────────────────────
    { id: "combo_01", slot: "combo", category: "offer", priority: "normal", url: "/menu", ctaLabel: "View Combo",
      title: "🍔🍟 Combo = Zyada swaad, kam kharcha", body: "Burger + fries + drink — sab ek saath, sab affordable." },
    { id: "combo_02", slot: "combo", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Combo",
      title: "🎯 Solo nahi, combo lo!", body: "FoodKnock ke combo deals try karo — perfect match, perfect price." },
    { id: "combo_03", slot: "combo", category: "offer", priority: "normal", url: "/menu", ctaLabel: "View Combo",
      title: "💰 Combo deals = smart choice", body: "Zyada value, kam paisa — abhi check karo." },

    // ── Menu: Burger ─────────────────────────────────────────────────────
    { id: "menu_burger_01", slot: "menu_burger", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Burger",
      title: "🍔 Burger cravings hit kar gayi?", body: "Juicy, cheesy, fresh — FoodKnock ka burger try karo abhi." },
    { id: "menu_burger_02", slot: "menu_burger", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "😋 Ek burger, sau khushiyan", body: "Order karo, taste karo, pyaar mein pado." },
    { id: "menu_burger_03", slot: "menu_burger", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Explore Menu",
      title: "🔥 Spicy ya classic — dono mil sakte hain", body: "Burger range mein kuch toh tumhare liye hoga." },

    // ── Menu: Pizza ──────────────────────────────────────────────────────
    { id: "menu_pizza_01", slot: "menu_pizza", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Pizza",
      title: "🍕 Pizza ka mann hai?", body: "Cheesy, hot, fresh — FoodKnock pe order karo abhi." },
    { id: "menu_pizza_02", slot: "menu_pizza", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "😍 Slice by slice, happiness guaranteed", body: "Pizza try karo, mood instantly better ho jaayega." },
    { id: "menu_pizza_03", slot: "menu_pizza", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🔥 Hot aur fresh, seedha tumhare door pe", body: "Pizza cravings ko halka mat lo — order karo." },

    // ── Menu: Momos ──────────────────────────────────────────────────────
    { id: "menu_momos_01", slot: "menu_momos", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Momos",
      title: "🥟 Momos ka time hai!", body: "Steamy, spicy, perfect — FoodKnock pe order karo." },
    { id: "menu_momos_02", slot: "menu_momos", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "😋 Momos + chutney = perfect evening", body: "Fresh momos ready hain, abhi order karo." },
    { id: "menu_momos_03", slot: "menu_momos", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🔥 Spicy momos craving?", body: "Hum samajhte hain. Order karo, satisfy karo." },

    // ── Menu: Sandwich ───────────────────────────────────────────────────
    { id: "menu_sandwich_01", slot: "menu_sandwich", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🥪 Quick aur tasty — sandwich time", body: "Fresh sandwiches order karo, light bhi heavy bhi." },
    { id: "menu_sandwich_02", slot: "menu_sandwich", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "😋 Sandwich cravings ko ignore mat karo", body: "Order karo, 25 minute mein door pe." },
    { id: "menu_sandwich_03", slot: "menu_sandwich", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🍞 Light lunch, full satisfaction", body: "Sandwiches try karo — fresh aur fast." },

    // ── Menu: Shakes ─────────────────────────────────────────────────────
    { id: "menu_shakes_01", slot: "menu_shakes", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Shake",
      title: "🥤 Shake ka mann hai?", body: "Thick, creamy, perfect — FoodKnock pe order karo." },
    { id: "menu_shakes_02", slot: "menu_shakes", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "😍 Thandi shake, garam mood theek", body: "Try karo, instant refresh feel karo." },
    { id: "menu_shakes_03", slot: "menu_shakes", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🍫 Chocolate ya strawberry — dono perfect", body: "FoodKnock ke shakes try karo abhi." },

    // ── New Menu ─────────────────────────────────────────────────────────
    { id: "new_menu_01", slot: "new_menu", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Explore Menu",
      title: "🆕 Kuch naya try karo!", body: "Menu mein naye items add hue hain — explore karo." },
    { id: "new_menu_02", slot: "new_menu", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Explore Menu",
      title: "✨ New dishes, naye flavors", body: "Menu update ho gaya hai — dekho kya naya hai aapke liye." },
    { id: "new_menu_03", slot: "new_menu", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Explore Menu",
      title: "👀 Pehli baar try karne ka time", body: "Naya menu live hai — abhi explore karo." },

    // ── Best Seller ──────────────────────────────────────────────────────
    { id: "best_seller_01", slot: "best_seller", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "⭐ Sabse zyada pasand kiya gaya dish", body: "Best seller try nahi kiya? Ab karo." },
    { id: "best_seller_02", slot: "best_seller", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🏆 Logo ka favorite, ab tumhara bhi?", body: "Best seller order karo, samajh jaaoge kyun." },
    { id: "best_seller_03", slot: "best_seller", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Order Now",
      title: "🔥 Trending on FoodKnock right now", body: "Sabse zyada order hone wala dish — try karo abhi." },

    // ── Comeback User ────────────────────────────────────────────────────
    { id: "comeback_user_01", slot: "comeback_user", category: "general", priority: "normal", url: "/menu", ctaLabel: "Order Again",
      title: "👋 Kahaan ho? Yaad aa rahe ho!", body: "Wapas aao — naye items wait kar rahe hain." },
    { id: "comeback_user_02", slot: "comeback_user", category: "general", priority: "normal", url: "/menu", ctaLabel: "Order Again",
      title: "😢 Bahut din ho gaye!", body: "Hum miss kar rahe hain. Wapas order karo, kuch naya try karo." },
    { id: "comeback_user_03", slot: "comeback_user", category: "general", priority: "normal", url: "/menu", ctaLabel: "Explore Menu",
      title: "🎁 Wapas aane ka perfect reason", body: "Naya menu hai — aao dekho kya badla hai." },

    // ── Inactive User ────────────────────────────────────────────────────
    { id: "inactive_user_01", slot: "inactive_user", category: "general", priority: "low", url: "/menu", ctaLabel: "Order Again",
      title: "🕰️ Bahut time ho gaya order kiye", body: "Kuch naya hai — ek baar phir try karo." },
    { id: "inactive_user_02", slot: "inactive_user", category: "general", priority: "low", url: "/menu", ctaLabel: "Order Now",
      title: "🤔 Sab theek hai? Hum yahin hain.", body: "Jab bhi bhook lage, FoodKnock yaad rakhna." },
    { id: "inactive_user_03", slot: "inactive_user", category: "general", priority: "low", url: "/menu", ctaLabel: "Order Again",
      title: "💭 Last order kab tha, yaad hai?", body: "Wapas order karo — kuch fresh, kuch naya try karo." },

    // ── Loyalty ──────────────────────────────────────────────────────────
    { id: "loyalty_01", slot: "loyalty", category: "reward", priority: "normal", url: "/loyalty", ctaLabel: "Claim Reward",
      title: "💎 Aapke loyalty points wait kar rahe hain", body: "Order karo, points use karo, save karo." },
    { id: "loyalty_02", slot: "loyalty", category: "reward", priority: "normal", url: "/loyalty", ctaLabel: "View Points",
      title: "🎁 Points hain, use karo!", body: "Account mein reward points pending hain — redeem karo abhi." },
    { id: "loyalty_03", slot: "loyalty", category: "reward", priority: "normal", url: "/loyalty", ctaLabel: "View Points",
      title: "✨ Loyalty se milta hai bonus", body: "Har order points deta hai — apna balance check karo." },

    // ── Reward ───────────────────────────────────────────────────────────
    { id: "reward_01", slot: "reward", category: "reward", priority: "high", url: "/loyalty", ctaLabel: "Claim Reward",
      title: "🎁 Aapke liye ek reward wait kar raha hai", body: "Check karo, claim karo, enjoy karo." },
    { id: "reward_02", slot: "reward", category: "reward", priority: "high", url: "/loyalty", ctaLabel: "Claim Reward",
      title: "🏆 Reward unlock ho gaya!", body: "Apna reward dekhne ke liye FoodKnock app open karo." },
    { id: "reward_03", slot: "reward", category: "reward", priority: "normal", url: "/loyalty", ctaLabel: "Claim Reward",
      title: "✨ Surprise! Kuch khaas mila hai", body: "Apna reward claim karo, FoodKnock pe abhi." },

    // ── Referral ─────────────────────────────────────────────────────────
    { id: "referral_01", slot: "referral", category: "reward", priority: "normal", url: "/loyalty", ctaLabel: "Refer & Earn",
      title: "👫 Dost ko invite karo, dono ko fayda!", body: "Referral se aapko aur aapke dost ko reward milega." },
    { id: "referral_02", slot: "referral", category: "reward", priority: "normal", url: "/loyalty", ctaLabel: "Refer & Earn",
      title: "🎉 Refer karo, reward pao", body: "Apna referral code share karo — jitna refer, utna fayda." },
    { id: "referral_03", slot: "referral", category: "reward", priority: "normal", url: "/loyalty", ctaLabel: "Refer & Earn",
      title: "💰 Dosti mein FoodKnock add karo", body: "Referral link share karo, dono ko milega reward." },

    // ── Review Reminder ──────────────────────────────────────────────────
    { id: "review_reminder_01", slot: "review_reminder", category: "general", priority: "normal", url: "/review-rewards", ctaLabel: "Review Now",
      title: "⭐ Aapka order kaisa tha?", body: "2 minute mein review do, reward bhi pao." },
    { id: "review_reminder_02", slot: "review_reminder", category: "general", priority: "normal", url: "/review-rewards", ctaLabel: "Review Now",
      title: "📝 Feedback chahiye aapse", body: "Apna experience share karo — FoodKnock behtar banta hai aapse." },
    { id: "review_reminder_03", slot: "review_reminder", category: "general", priority: "normal", url: "/review-rewards", ctaLabel: "Review Now",
      title: "🙏 Ek review, bahut fayda", body: "Apna last order review karo, exclusive reward unlock karo." },

    // ── Abandoned Cart (future-ready) ────────────────────────────────────
    { id: "abandoned_cart_01", slot: "abandoned_cart", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Complete Order",
      title: "🛒 Kuch cart mein reh gaya!", body: "Order complete karo — items wait kar rahe hain." },
    { id: "abandoned_cart_02", slot: "abandoned_cart", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Complete Order",
      title: "👀 Bhool gaye kya cart mein?", body: "Wapas jao, order finish karo." },
    { id: "abandoned_cart_03", slot: "abandoned_cart", category: "offer", priority: "normal", url: "/menu", ctaLabel: "Complete Order",
      title: "⏰ Cart abhi bhi ready hai", body: "Bas ek tap door hai — order complete karo abhi." },
];

