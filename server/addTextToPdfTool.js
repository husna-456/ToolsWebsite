// One-off script: upserts only the text-to-pdf tool without touching others.
// Run once after the server has been set up:
//   node server/addTextToPdfTool.js
require('dotenv').config();
const connectDB = require('./config/db');
const Tool      = require('./models/Tool');

const toolData = {
  slug:      'text-to-pdf',
  title:     'Text to PDF',
  shortDesc: 'Paste Urdu, Arabic, or English text — AI formats it into a professional PDF. Add more content anytime.',
  longDesc:  'Paste raw text in any language and AI automatically formats it into a professionally printed document. Supports Urdu (Noto Nastaliq), Arabic (full tashkeel), and English. Build your document over multiple sessions — paste today, add more tomorrow, always get one complete PDF.',
  icon:      'FileDown',
  category:  'text-tools',
  tags:      ['pdf', 'urdu', 'arabic', 'english', 'format', 'print', 'nastaleeq', 'document', 'merge'],
  isActive:  true, isFree: true, isPremium: false, order: 20,
  seoTitle:       'Free Text to PDF — Urdu Arabic English Auto Formatter',
  seoDescription: 'Paste Urdu, Arabic, or English text and get a professionally formatted PDF. AI auto-formats. Add content over multiple days into one document.',
  seoKeywords:    'text to pdf, urdu pdf, arabic pdf, pdf generator, urdu nastaleeq pdf, islamic document pdf',
  howToUse: [
    'Paste your text — Urdu, Arabic, or English',
    'Click Format — AI structures your content automatically',
    'Review the preview and edit anything if needed',
    'Click Generate PDF to download',
    'Come back anytime — open your saved document and add more content',
    'Every session appends to your existing document',
  ],
  faqs: [
    { question: 'Can I add more content to my PDF on another day?',    answer: 'Yes. Your document is saved automatically in your browser. Come back anytime, open it, paste new content, and it gets appended. Generate PDF whenever you want — it includes everything.' },
    { question: 'Can I have multiple separate documents?',             answer: 'Yes. Create as many documents as you want — Hadees notes, grammar lessons, essays — each saved separately.' },
    { question: 'Will Urdu Nastaliq render correctly?',                answer: 'Yes. Noto Nastaliq Urdu font is used — the standard Nastaliq typeface for professional Urdu documents.' },
    { question: 'Will Arabic harakat show correctly?',                 answer: 'Yes. Noto Naskh Arabic via Puppeteer preserves all diacritical marks (tashkeel) perfectly.' },
    { question: 'Can I edit the AI-formatted content?',                answer: 'Yes. Click any section in the preview to edit it directly before generating the PDF.' },
    { question: 'Is my document data stored on the server?',           answer: "No. All document data is saved only in your browser's localStorage. Nothing is sent to the server until you click Generate PDF." },
  ],
  relatedTools: ['word-counter', 'summarizer', 'citation-generator'],
  whatItDoes:   'Converts raw text into professionally formatted PDFs with AI. Supports multi-session document building — add content over multiple days and always get one complete PDF.',
  whoShouldUse: 'Students compiling Islamic notes over time, researchers building Arabic documents, anyone creating Urdu printed materials across multiple sessions.',
  whenToUse:    'When you want to build a document gradually — paste today, add more tomorrow, download whenever ready.',
  usageCount: 0,
};

(async () => {
  try {
    await connectDB();
    const result = await Tool.findOneAndUpdate(
      { slug: 'text-to-pdf' },
      toolData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`✅ text-to-pdf tool ${result.isNew ? 'inserted' : 'updated'} successfully.`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exit(1);
  }
})();
