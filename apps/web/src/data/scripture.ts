// Daily ESV scripture shown on the resident home.
// 75 selections (76 verses), verified against official ESV.org passage pages.
// Sources are stored per entry; Psalm references use ESV numbering.
// Psalm headings/verse numbers are omitted; LORD preserves divine-name styling.
// Selection order and Philippine-time daily rotation are retained.
// Quotation terms and review notes: docs/ESV-SCRIPTURE.md.
export type Verse = { verse: string; reference: string; source: string };

export const esvCopyrightNotice =
  "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. ESV Text Edition: 2025. The ESV text may not be quoted in any publication made available to the public by a Creative Commons license. The ESV may not be translated in whole or in part into any other language. Used by permission. All rights reserved.";

export const verses: Verse[] = [
  {
    reference: "Matthew 11:28",
    verse:
      "Come to me, all who labor and are heavy laden, and I will give you rest.",
    source: "https://www.esv.org/verses/Matthew%2011%3A28/",
  },
  {
    reference: "Philippians 4:13",
    verse: "I can do all things through him who strengthens me.",
    source: "https://www.esv.org/verses/Philippians%204%3A13/",
  },
  {
    reference: "Psalm 23:1",
    verse: "The LORD is my shepherd; I shall not want.",
    source: "https://www.esv.org/verses/Psalm%2023%3A1/",
  },
  {
    reference: "1 Peter 5:7",
    verse: "casting all your anxieties on him, because he cares for you.",
    source: "https://www.esv.org/verses/1%20Peter%205%3A7/",
  },
  {
    reference: "Philippians 4:6",
    verse:
      "do not be anxious about anything, but in everything by prayer and supplication with thanksgiving let your requests be made known to God.",
    source: "https://www.esv.org/verses/Philippians%204%3A6/",
  },
  {
    reference: "Proverbs 3:5",
    verse:
      "Trust in the LORD with all your heart, and do not lean on your own understanding.",
    source: "https://www.esv.org/verses/Proverbs%203%3A5/",
  },
  {
    reference: "Isaiah 41:10",
    verse:
      "fear not, for I am with you; be not dismayed, for I am your God; I will strengthen you, I will help you, I will uphold you with my righteous right hand.",
    source: "https://www.esv.org/verses/Isaiah%2041%3A10/",
  },
  {
    reference: "Joshua 1:9",
    verse:
      "Have I not commanded you? Be strong and courageous. Do not be frightened, and do not be dismayed, for the LORD your God is with you wherever you go.”",
    source: "https://www.esv.org/verses/Joshua%201%3A9/",
  },
  {
    reference: "John 3:16",
    verse:
      "“For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.",
    source: "https://www.esv.org/verses/John%203%3A16/",
  },
  {
    reference: "Matthew 6:33",
    verse:
      "But seek first the kingdom of God and his righteousness, and all these things will be added to you.",
    source: "https://www.esv.org/verses/Matthew%206%3A33/",
  },
  {
    reference: "Psalm 46:1",
    verse: "God is our refuge and strength, a very present help in trouble.",
    source: "https://www.esv.org/verses/Psalm%2046%3A1/",
  },
  {
    reference: "Romans 8:28",
    verse:
      "And we know that for those who love God all things work together for good, for those who are called according to his purpose.",
    source: "https://www.esv.org/verses/Romans%208%3A28/",
  },
  {
    reference: "Psalm 118:24",
    verse:
      "This is the day that the LORD has made; let us rejoice and be glad in it.",
    source: "https://www.esv.org/verses/Psalm%20118%3A24/",
  },
  {
    reference: "Jeremiah 29:11",
    verse:
      "For I know the plans I have for you, declares the LORD, plans for welfare and not for evil, to give you a future and a hope.",
    source: "https://www.esv.org/verses/Jeremiah%2029%3A11/",
  },
  {
    reference: "Matthew 5:9",
    verse:
      "“Blessed are the peacemakers, for they shall be called sons of God.",
    source: "https://www.esv.org/verses/Matthew%205%3A9/",
  },
  {
    reference: "1 Corinthians 13:4",
    verse:
      "Love is patient and kind; love does not envy or boast; it is not arrogant",
    source: "https://www.esv.org/verses/1%20Corinthians%2013%3A4/",
  },
  {
    reference: "Psalm 34:8",
    verse:
      "Oh, taste and see that the LORD is good! Blessed is the man who takes refuge in him!",
    source: "https://www.esv.org/verses/Psalm%2034%3A8/",
  },
  {
    reference: "Isaiah 40:31",
    verse:
      "but they who wait for the LORD shall renew their strength; they shall mount up with wings like eagles; they shall run and not be weary; they shall walk and not faint.",
    source: "https://www.esv.org/verses/Isaiah%2040%3A31/",
  },
  {
    reference: "Matthew 7:7",
    verse:
      "“Ask, and it will be given to you; seek, and you will find; knock, and it will be opened to you.",
    source: "https://www.esv.org/verses/Matthew%207%3A7/",
  },
  {
    reference: "Psalm 91:1",
    verse:
      "He who dwells in the shelter of the Most High will abide in the shadow of the Almighty.",
    source: "https://www.esv.org/verses/Psalm%2091%3A1/",
  },
  {
    reference: "Proverbs 16:3",
    verse: "Commit your work to the LORD, and your plans will be established.",
    source: "https://www.esv.org/verses/Proverbs%2016%3A3/",
  },
  {
    reference: "Colossians 3:23",
    verse: "Whatever you do, work heartily, as for the Lord and not for men,",
    source: "https://www.esv.org/verses/Colossians%203%3A23/",
  },
  {
    reference: "Psalm 37:5",
    verse: "Commit your way to the LORD; trust in him, and he will act.",
    source: "https://www.esv.org/verses/Psalm%2037%3A5/",
  },
  {
    reference: "2 Timothy 1:7",
    verse:
      "for God gave us a spirit not of fear but of power and love and self-control.",
    source: "https://www.esv.org/verses/2%20Timothy%201%3A7/",
  },
  {
    reference: "John 14:27",
    verse:
      "Peace I leave with you; my peace I give to you. Not as the world gives do I give to you. Let not your hearts be troubled, neither let them be afraid.",
    source: "https://www.esv.org/verses/John%2014%3A27/",
  },
  {
    reference: "Psalm 55:22",
    verse:
      "Cast your burden on the LORD, and he will sustain you; he will never permit the righteous to be moved.",
    source: "https://www.esv.org/verses/Psalm%2055%3A22/",
  },
  {
    reference: "Matthew 5:16",
    verse:
      "In the same way, let your light shine before others, so that they may see your good works and give glory to your Father who is in heaven.",
    source: "https://www.esv.org/verses/Matthew%205%3A16/",
  },
  {
    reference: "Galatians 6:9",
    verse:
      "And let us not grow weary of doing good, for in due season we will reap, if we do not give up.",
    source: "https://www.esv.org/verses/Galatians%206%3A9/",
  },
  {
    reference: "Psalm 27:1",
    verse:
      "The LORD is my light and my salvation; whom shall I fear? The LORD is the stronghold of my life; of whom shall I be afraid?",
    source: "https://www.esv.org/verses/Psalm%2027%3A1/",
  },
  {
    reference: "1 Thessalonians 5:18",
    verse:
      "give thanks in all circumstances; for this is the will of God in Christ Jesus for you.",
    source: "https://www.esv.org/verses/1%20Thessalonians%205%3A18/",
  },
  {
    reference: "Proverbs 17:17",
    verse: "A friend loves at all times, and a brother is born for adversity.",
    source: "https://www.esv.org/verses/Proverbs%2017%3A17/",
  },
  {
    reference: "Psalm 145:18",
    verse:
      "The LORD is near to all who call on him, to all who call on him in truth.",
    source: "https://www.esv.org/verses/Psalm%20145%3A18/",
  },
  {
    reference: "Micah 6:8",
    verse:
      "He has told you, O man, what is good; and what does the LORD require of you but to do justice, and to love kindness, and to walk humbly with your God?",
    source: "https://www.esv.org/verses/Micah%206%3A8/",
  },
  {
    reference: "John 13:34",
    verse:
      "A new commandment I give to you, that you love one another: just as I have loved you, you also are to love one another.",
    source: "https://www.esv.org/verses/John%2013%3A34/",
  },
  {
    reference: "Ephesians 4:32",
    verse:
      "Be kind to one another, tenderhearted, forgiving one another, as God in Christ forgave you.",
    source: "https://www.esv.org/verses/Ephesians%204%3A32/",
  },
  {
    reference: "Lamentations 3:22-23",
    verse:
      "The steadfast love of the LORD never ceases; his mercies never come to an end; they are new every morning; great is your faithfulness.",
    source: "https://www.esv.org/verses/Lamentations%203%3A22-23/",
  },
  {
    reference: "Matthew 6:34",
    verse:
      "“Therefore do not be anxious about tomorrow, for tomorrow will be anxious for itself. Sufficient for the day is its own trouble.",
    source: "https://www.esv.org/verses/Matthew%206%3A34/",
  },
  {
    reference: "Psalm 32:8",
    verse:
      "I will instruct you and teach you in the way you should go; I will counsel you with my eye upon you.",
    source: "https://www.esv.org/verses/Psalm%2032%3A8/",
  },
  {
    reference: "Romans 12:12",
    verse: "Rejoice in hope, be patient in tribulation, be constant in prayer.",
    source: "https://www.esv.org/verses/Romans%2012%3A12/",
  },
  {
    reference: "Hebrews 11:1",
    verse:
      "Now faith is the assurance of things hoped for, the conviction of things not seen.",
    source: "https://www.esv.org/verses/Hebrews%2011%3A1/",
  },
  {
    reference: "Psalm 23:4",
    verse:
      "Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me; your rod and your staff, they comfort me.",
    source: "https://www.esv.org/verses/Psalm%2023%3A4/",
  },
  {
    reference: "1 Corinthians 16:14",
    verse: "Let all that you do be done in love.",
    source: "https://www.esv.org/verses/1%20Corinthians%2016%3A14/",
  },
  {
    reference: "Proverbs 15:1",
    verse: "A soft answer turns away wrath, but a harsh word stirs up anger.",
    source: "https://www.esv.org/verses/Proverbs%2015%3A1/",
  },
  {
    reference: "James 1:5",
    verse:
      "If any of you lacks wisdom, let him ask God, who gives generously to all without reproach, and it will be given him.",
    source: "https://www.esv.org/verses/James%201%3A5/",
  },
  {
    reference: "Psalm 119:105",
    verse: "Your word is a lamp to my feet and a light to my path.",
    source: "https://www.esv.org/verses/Psalm%20119%3A105/",
  },
  {
    reference: "Matthew 19:26",
    verse:
      "But Jesus looked at them and said, “With man this is impossible, but with God all things are possible.”",
    source: "https://www.esv.org/verses/Matthew%2019%3A26/",
  },
  {
    reference: "Isaiah 26:3",
    verse:
      "You keep him in perfect peace whose mind is stayed on you, because he trusts in you.",
    source: "https://www.esv.org/verses/Isaiah%2026%3A3/",
  },
  {
    reference: "Psalm 118:1",
    verse:
      "Oh give thanks to the LORD, for he is good; for his steadfast love endures forever!",
    source: "https://www.esv.org/verses/Psalm%20118%3A1/",
  },
  {
    reference: "2 Corinthians 12:9",
    verse:
      "But he said to me, “My grace is sufficient for you, for my power is made perfect in weakness.” Therefore I will boast all the more gladly of my weaknesses, so that the power of Christ may rest upon me.",
    source: "https://www.esv.org/verses/2%20Corinthians%2012%3A9/",
  },
  {
    reference: "John 8:12",
    verse:
      "Again Jesus spoke to them, saying, “I am the light of the world. Whoever follows me will not walk in darkness, but will have the light of life.”",
    source: "https://www.esv.org/verses/John%208%3A12/",
  },
  {
    reference: "Psalm 42:1",
    verse:
      "As a deer pants for flowing streams, so pants my soul for you, O God.",
    source: "https://www.esv.org/verses/Psalm%2042%3A1/",
  },
  {
    reference: "Matthew 28:20",
    verse:
      "teaching them to observe all that I have commanded you. And behold, I am with you always, to the end of the age.”",
    source: "https://www.esv.org/verses/Matthew%2028%3A20/",
  },
  {
    reference: "Psalm 56:4",
    verse:
      "In God, whose word I praise, in God I trust; I shall not be afraid. What can flesh do to me?",
    source: "https://www.esv.org/verses/Psalm%2056%3A4/",
  },
  {
    reference: "1 John 4:19",
    verse: "We love because he first loved us.",
    source: "https://www.esv.org/verses/1%20John%204%3A19/",
  },
  {
    reference: "Ecclesiastes 3:1",
    verse:
      "For everything there is a season, and a time for every matter under heaven:",
    source: "https://www.esv.org/verses/Ecclesiastes%203%3A1/",
  },
  {
    reference: "Psalm 95:1",
    verse:
      "Oh come, let us sing to the LORD; let us make a joyful noise to the rock of our salvation!",
    source: "https://www.esv.org/verses/Psalm%2095%3A1/",
  },
  {
    reference: "Romans 15:13",
    verse:
      "May the God of hope fill you with all joy and peace in believing, so that by the power of the Holy Spirit you may abound in hope.",
    source: "https://www.esv.org/verses/Romans%2015%3A13/",
  },
  {
    reference: "Matthew 5:6",
    verse:
      "“Blessed are those who hunger and thirst for righteousness, for they shall be satisfied.",
    source: "https://www.esv.org/verses/Matthew%205%3A6/",
  },
  {
    reference: "Psalm 126:3",
    verse: "The LORD has done great things for us; we are glad.",
    source: "https://www.esv.org/verses/Psalm%20126%3A3/",
  },
  {
    reference: "Philippians 4:7",
    verse:
      "And the peace of God, which surpasses all understanding, will guard your hearts and your minds in Christ Jesus.",
    source: "https://www.esv.org/verses/Philippians%204%3A7/",
  },
  {
    reference: "Proverbs 3:6",
    verse:
      "In all your ways acknowledge him, and he will make straight your paths.",
    source: "https://www.esv.org/verses/Proverbs%203%3A6/",
  },
  {
    reference: "John 15:12",
    verse:
      "“This is my commandment, that you love one another as I have loved you.",
    source: "https://www.esv.org/verses/John%2015%3A12/",
  },
  {
    reference: "Psalm 34:18",
    verse:
      "The LORD is near to the brokenhearted and saves the crushed in spirit.",
    source: "https://www.esv.org/verses/Psalm%2034%3A18/",
  },
  {
    reference: "1 Peter 4:8",
    verse:
      "Above all, keep loving one another earnestly, since love covers a multitude of sins.",
    source: "https://www.esv.org/verses/1%20Peter%204%3A8/",
  },
  {
    reference: "Isaiah 43:2",
    verse:
      "When you pass through the waters, I will be with you; and through the rivers, they shall not overwhelm you; when you walk through fire you shall not be burned, and the flame shall not consume you.",
    source: "https://www.esv.org/verses/Isaiah%2043%3A2/",
  },
  {
    reference: "Psalm 103:8",
    verse:
      "The LORD is merciful and gracious, slow to anger and abounding in steadfast love.",
    source: "https://www.esv.org/verses/Psalm%20103%3A8/",
  },
  {
    reference: "Matthew 6:21",
    verse: "For where your treasure is, there your heart will be also.",
    source: "https://www.esv.org/verses/Matthew%206%3A21/",
  },
  {
    reference: "Galatians 5:22",
    verse:
      "But the fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faithfulness,",
    source: "https://www.esv.org/verses/Galatians%205%3A22/",
  },
  {
    reference: "Psalm 19:1",
    verse:
      "The heavens declare the glory of God, and the sky above proclaims his handiwork.",
    source: "https://www.esv.org/verses/Psalm%2019%3A1/",
  },
  {
    reference: "Proverbs 18:10",
    verse:
      "The name of the LORD is a strong tower; the righteous man runs into it and is safe.",
    source: "https://www.esv.org/verses/Proverbs%2018%3A10/",
  },
  {
    reference: "John 16:33",
    verse:
      "I have said these things to you, that in me you may have peace. In the world you will have tribulation. But take heart; I have overcome the world.”",
    source: "https://www.esv.org/verses/John%2016%3A33/",
  },
  {
    reference: "Psalm 51:10",
    verse:
      "Create in me a clean heart, O God, and renew a right spirit within me.",
    source: "https://www.esv.org/verses/Psalm%2051%3A10/",
  },
  {
    reference: "Deuteronomy 31:6",
    verse:
      "Be strong and courageous. Do not fear or be in dread of them, for it is the LORD your God who goes with you. He will not leave you or forsake you.”",
    source: "https://www.esv.org/verses/Deuteronomy%2031%3A6/",
  },
  {
    reference: "Proverbs 17:22",
    verse:
      "A joyful heart is good medicine, but a crushed spirit dries up the bones.",
    source: "https://www.esv.org/verses/Proverbs%2017%3A22/",
  },
  {
    reference: "Galatians 6:2",
    verse: "Bear one another’s burdens, and so fulfill the law of Christ.",
    source: "https://www.esv.org/verses/Galatians%206%3A2/",
  },
];

// One verse per day — the same for everyone that day in Philippine time, and
// drifting year to year so no verse locks to a calendar date. Works with any
// list length; leap years need no special case because the index wraps (modulo).
export function verseOfTheDay(now: Date = new Date()): Verse {
  const manilaDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // YYYY-MM-DD
  const dayNumber = Math.floor(
    Date.parse(manilaDate + "T00:00:00Z") / 86_400_000,
  );
  const count = verses.length || 1;
  const index = ((dayNumber % count) + count) % count;
  return verses[index];
}
