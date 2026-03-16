import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";

/* ─── Question bank ─── */
type QType = "Behavioral" | "Technical" | "HR";
type Question = { q: string; type: QType; tip: string };
type Category = "Frontend" | "Backend" | "Data" | "Design" | "PM" | "General HR";

const QUESTIONS: Record<Category, Question[]> = {
  Frontend: [
    {q:"Explain the virtual DOM and how React uses it.",type:"Technical",tip:"Compare real DOM mutations vs batched virtual updates."},
    {q:"How do you optimize a slow React component?",type:"Technical",tip:"Mention React.memo, useMemo, useCallback, lazy loading."},
    {q:"What is the difference between useEffect and useLayoutEffect?",type:"Technical",tip:"useLayoutEffect fires synchronously after DOM mutations."},
    {q:"Describe CSS specificity and how conflicts are resolved.",type:"Technical",tip:"Inline > ID > class > element. !important overrides."},
    {q:"Explain event delegation in JavaScript.",type:"Technical",tip:"Events bubble up; attach listener to parent, check target."},
    {q:"What are Web Vitals and how do you measure them?",type:"Technical",tip:"LCP, FID, CLS — use Lighthouse or web-vitals library."},
    {q:"Walk me through a time you had to meet a tight deadline.",type:"Behavioral",tip:"STAR: Situation, Task, Action, Result."},
    {q:"Tell me about a project you're most proud of.",type:"Behavioral",tip:"Focus on impact, challenges overcome, technical decisions."},
    {q:"How do you handle disagreements with a designer?",type:"Behavioral",tip:"Show collaboration, compromise, and user-focus."},
    {q:"Describe a time you improved an existing codebase.",type:"Behavioral",tip:"Mention refactoring, testing, measurable improvement."},
    {q:"Why do you want to work here?",type:"HR",tip:"Research the company; connect values to your goals."},
    {q:"Where do you see yourself in 3 years?",type:"HR",tip:"Show ambition aligned with the role's growth path."},
    {q:"What is your approach to learning new technologies?",type:"HR",tip:"Mention side projects, documentation, community."},
    {q:"How do you handle constructive criticism?",type:"HR",tip:"Show openness, give a real example of growth."},
    {q:"What's your biggest weakness?",type:"HR",tip:"Be honest but show how you're actively improving."},
  ],
  Backend: [
    {q:"Explain REST vs GraphQL. When would you choose each?",type:"Technical",tip:"REST: resource-based, cacheable. GraphQL: flexible queries."},
    {q:"What is the N+1 query problem and how do you solve it?",type:"Technical",tip:"Use eager loading / dataloader pattern."},
    {q:"Describe database indexing strategies.",type:"Technical",tip:"B-tree, hash, composite indexes; trade-offs with writes."},
    {q:"How do you handle authentication and authorization?",type:"Technical",tip:"JWT, OAuth2, role-based access control."},
    {q:"Explain microservices vs monolith architecture.",type:"Technical",tip:"Microservices: independent deploy. Monolith: simpler ops."},
    {q:"What is a race condition? How do you prevent it?",type:"Technical",tip:"Mutexes, database locks, optimistic concurrency."},
    {q:"Tell me about a production incident you resolved.",type:"Behavioral",tip:"STAR format with metrics on resolution time."},
    {q:"How do you prioritize between tech debt and features?",type:"Behavioral",tip:"Show business awareness and pragmatic trade-offs."},
    {q:"Describe a time you mentored a junior developer.",type:"Behavioral",tip:"Focus on knowledge transfer and their growth."},
    {q:"How do you approach code reviews?",type:"Behavioral",tip:"Be constructive, focus on logic / security / readability."},
    {q:"Why backend development specifically?",type:"HR",tip:"Show passion for systems, data, and scalability."},
    {q:"How do you stay current with backend technologies?",type:"HR",tip:"Blogs, conferences, open-source contributions."},
    {q:"Describe your ideal team culture.",type:"HR",tip:"Show you value ownership, transparency, and feedback."},
    {q:"What motivates you at work?",type:"HR",tip:"Connect to impact, learning, and problem-solving."},
    {q:"Tell me about a time you failed.",type:"HR",tip:"Show accountability and what you learned."},
  ],
  Data: [
    {q:"Explain the difference between supervised and unsupervised learning.",type:"Technical",tip:"Supervised: labeled data. Unsupervised: clustering/patterns."},
    {q:"What is a p-value and when is it meaningful?",type:"Technical",tip:"Probability of observing data given null hypothesis is true."},
    {q:"How do you handle missing data in a dataset?",type:"Technical",tip:"Imputation, deletion, or flagging — depends on context."},
    {q:"Explain the bias-variance trade-off.",type:"Technical",tip:"High bias = underfitting. High variance = overfitting."},
    {q:"What SQL window functions do you use most?",type:"Technical",tip:"ROW_NUMBER, RANK, LAG/LEAD, SUM OVER."},
    {q:"How do you validate a machine learning model?",type:"Technical",tip:"Train/test split, cross-validation, precision/recall."},
    {q:"Tell me about a data-driven decision you influenced.",type:"Behavioral",tip:"Show impact with specific metrics."},
    {q:"How do you communicate complex findings to non-technical stakeholders?",type:"Behavioral",tip:"Visualizations, analogies, focus on business impact."},
    {q:"Describe a time you found an unexpected insight in data.",type:"Behavioral",tip:"Show curiosity and how you verified the finding."},
    {q:"How do you handle ambiguous requirements?",type:"Behavioral",tip:"Ask clarifying questions, propose hypotheses."},
    {q:"Why data science / data analysis?",type:"HR",tip:"Connect curiosity about patterns to business value."},
    {q:"What tools do you prefer for analysis?",type:"HR",tip:"Python, SQL, Tableau/Power BI — explain why."},
    {q:"How do you ensure data quality?",type:"HR",tip:"Validation rules, automated tests, documentation."},
    {q:"Where do you see the data field heading?",type:"HR",tip:"AI/ML democratization, real-time analytics."},
    {q:"What's a dataset you've worked on that excited you?",type:"HR",tip:"Show genuine enthusiasm; explain the challenge."},
  ],
  Design: [
    {q:"Walk me through your design process.",type:"Technical",tip:"Research → Ideate → Wireframe → Prototype → Test."},
    {q:"How do you handle accessibility in your designs?",type:"Technical",tip:"WCAG guidelines, color contrast, keyboard navigation."},
    {q:"Explain the difference between UX and UI.",type:"Technical",tip:"UX = overall experience. UI = visual interface layer."},
    {q:"How do you validate a design decision?",type:"Technical",tip:"User testing, A/B tests, analytics, heuristic review."},
    {q:"What's your approach to design systems?",type:"Technical",tip:"Reusable components, tokens, documentation."},
    {q:"How do you handle conflicting stakeholder feedback?",type:"Behavioral",tip:"Prioritize user needs, use data to back decisions."},
    {q:"Tell me about a design you iterated on significantly.",type:"Behavioral",tip:"Show willingness to change based on evidence."},
    {q:"How do you collaborate with developers?",type:"Behavioral",tip:"Design handoff, token-based specs, ongoing dialogue."},
    {q:"Describe a time a user test changed your approach.",type:"Behavioral",tip:"Show humility and focus on user outcomes."},
    {q:"How do you stay inspired creatively?",type:"Behavioral",tip:"Dribbble, conferences, cross-discipline exploration."},
    {q:"Why design as a career?",type:"HR",tip:"Show empathy for users and love for problem-solving."},
    {q:"What's your favorite product and why?",type:"HR",tip:"Analyze UX choices in your answer."},
    {q:"How do you prioritize features?",type:"HR",tip:"Impact vs effort matrix, user research."},
    {q:"What design tools do you use?",type:"HR",tip:"Figma, Sketch, Adobe XD — explain workflow."},
    {q:"How do you handle tight deadlines on design work?",type:"HR",tip:"Scope appropriately, communicate trade-offs early."},
  ],
  PM: [
    {q:"How do you prioritize a product backlog?",type:"Technical",tip:"RICE, MoSCoW, or Impact/Effort matrix."},
    {q:"Explain how you'd define success metrics for a new feature.",type:"Technical",tip:"North star metric, leading/lagging indicators."},
    {q:"Walk me through a product launch you managed.",type:"Technical",tip:"Planning, cross-functional alignment, post-launch analysis."},
    {q:"How do you handle scope creep?",type:"Technical",tip:"Clear requirements, change management process."},
    {q:"Describe your approach to user research.",type:"Technical",tip:"Interviews, surveys, analytics, jobs-to-be-done."},
    {q:"How do you work with engineering teams?",type:"Behavioral",tip:"Respect technical constraints, collaborative planning."},
    {q:"Tell me about a time you had to say no to a stakeholder.",type:"Behavioral",tip:"Data-backed reasoning, clear communication."},
    {q:"Describe a product failure you learned from.",type:"Behavioral",tip:"Show accountability and actionable takeaways."},
    {q:"How do you build consensus across teams?",type:"Behavioral",tip:"Active listening, shared goals, documentation."},
    {q:"Tell me about a difficult trade-off decision.",type:"Behavioral",tip:"Framework: user impact, business value, technical cost."},
    {q:"Why product management?",type:"HR",tip:"Intersection of business, technology, and user needs."},
    {q:"How do you stay customer-focused?",type:"HR",tip:"Regular user interactions, feedback loops."},
    {q:"What PM frameworks do you use?",type:"HR",tip:"Agile, Lean, Design Thinking."},
    {q:"How do you handle ambiguity?",type:"HR",tip:"Break into hypotheses, validate incrementally."},
    {q:"What's a product you'd improve and how?",type:"HR",tip:"Show analytical thinking and empathy."},
  ],
  "General HR": [
    {q:"Tell me about yourself.",type:"HR",tip:"2-min pitch: background, current role, why this opportunity."},
    {q:"Why are you looking for a new opportunity?",type:"HR",tip:"Be positive; focus on growth, not complaints."},
    {q:"What are your salary expectations?",type:"HR",tip:"Research market rates; give a range."},
    {q:"Describe your ideal work environment.",type:"HR",tip:"Align with company culture you've researched."},
    {q:"How do you handle stress?",type:"HR",tip:"Concrete strategies: prioritization, breaks, communication."},
    {q:"Tell me about a conflict with a coworker.",type:"Behavioral",tip:"STAR format; show resolution and maturity."},
    {q:"Describe a time you showed leadership.",type:"Behavioral",tip:"Leadership without authority counts."},
    {q:"How do you manage multiple priorities?",type:"Behavioral",tip:"Tools, frameworks, and communication."},
    {q:"Tell me about a time you went above and beyond.",type:"Behavioral",tip:"Show initiative and impact."},
    {q:"Describe a situation where you had to adapt quickly.",type:"Behavioral",tip:"Show flexibility and positive outcome."},
    {q:"What do you know about our company?",type:"HR",tip:"Research mission, products, recent news."},
    {q:"What questions do you have for us?",type:"HR",tip:"Ask about team, growth, and challenges."},
    {q:"How would your last manager describe you?",type:"HR",tip:"Be honest; use their actual feedback."},
    {q:"What makes you unique as a candidate?",type:"HR",tip:"Specific skills + experience combination."},
    {q:"When can you start?",type:"HR",tip:"Be realistic about notice period."},
  ],
};

const CATEGORIES: Category[] = ["Frontend", "Backend", "Data", "Design", "PM", "General HR"];
type Difficulty = "Easy" | "Medium" | "Hard";
type PrepModule = "PRACTICE" | "MOCK" | "QUIZ" | "CODE" | "BLANK" | "REVIEW";
type CodeLanguage = "javascript" | "python";
type ModuleMetric = { ts: number; score: number };

type QuestionKey = string;

function questionKey(category: Category, difficulty: Difficulty, questionText: string): QuestionKey {
  return `${category}::${difficulty}::${questionText}`;
}

function hasProgressSignal(opts: { answer?: string; rating?: number; done?: boolean; note?: string }) {
  return Boolean((opts.answer ?? "").trim() || (opts.note ?? "").trim() || (opts.rating ?? 0) > 0 || opts.done);
}

type CodingChallenge = {
  id: string;
  title: string;
  difficulty: Difficulty;
  tags: string[];
  prompt: string;
  constraints: string[];
  exampleInput: string;
  exampleOutput: string;
  starterCode: Record<CodeLanguage, string>;
  requiredSnippets: Record<CodeLanguage, string[]>;
};

type BlankChallenge = {
  id: string;
  category: Category;
  difficulty: Difficulty;
  prompt: string;
  sentenceParts: [string, string];
  answer: string;
  hint: string;
};

const CODING_CHALLENGES: CodingChallenge[] = [
  {
    id: "two-sum-index",
    title: "Two Sum Index",
    difficulty: "Easy",
    tags: ["Array", "Hash Map"],
    prompt: "Given an array of integers and a target, return indices of two numbers such that they add up to target.",
    constraints: ["Exactly one valid pair exists", "Do not reuse the same element", "Return index pair in any order"],
    exampleInput: "nums = [2,7,11,15], target = 9",
    exampleOutput: "[0,1]",
    starterCode: {
      javascript: "function solve(nums, target) {\n  // TODO: return [i, j]\n  return [];\n}\n",
      python: "def solve(nums, target):\n    # TODO: return [i, j]\n    return []\n",
    },
    requiredSnippets: {
      javascript: ["for", "return"],
      python: ["for", "return"],
    },
  },
  {
    id: "valid-parentheses",
    title: "Valid Parentheses",
    difficulty: "Medium",
    tags: ["Stack", "String"],
    prompt: "Given a string containing only brackets, determine if the input string is valid.",
    constraints: ["Input size up to 10^4", "Opening bracket must be closed by same type", "Maintain correct order"],
    exampleInput: "s = \"()[]{}\"",
    exampleOutput: "true",
    starterCode: {
      javascript: "function solve(s) {\n  // TODO: return true/false\n  return false;\n}\n",
      python: "def solve(s):\n    # TODO: return True/False\n    return False\n",
    },
    requiredSnippets: {
      javascript: ["stack", "return"],
      python: ["stack", "return"],
    },
  },
  {
    id: "merge-intervals",
    title: "Merge Intervals",
    difficulty: "Hard",
    tags: ["Sorting", "Intervals"],
    prompt: "Merge all overlapping intervals and return an array of non-overlapping intervals.",
    constraints: ["Intervals length up to 10^4", "Each interval has start <= end", "Output should be sorted by start"],
    exampleInput: "[[1,3],[2,6],[8,10],[15,18]]",
    exampleOutput: "[[1,6],[8,10],[15,18]]",
    starterCode: {
      javascript: "function solve(intervals) {\n  // TODO: merge and return intervals\n  return intervals;\n}\n",
      python: "def solve(intervals):\n    # TODO: merge and return intervals\n    return intervals\n",
    },
    requiredSnippets: {
      javascript: ["sort", "push", "return"],
      python: ["sort", "append", "return"],
    },
  },
];

const BLANK_CHALLENGES: BlankChallenge[] = [
  {
    id: "fe-usememo",
    category: "Frontend",
    difficulty: "Easy",
    prompt: "React optimization",
    sentenceParts: ["Use ", " to memoize expensive computed values between renders."],
    answer: "useMemo",
    hint: "Hook name starts with 'use' and ends with 'Memo'.",
  },
  {
    id: "be-rbac",
    category: "Backend",
    difficulty: "Medium",
    prompt: "Access control",
    sentenceParts: ["Role-based access control is commonly abbreviated as ", "."],
    answer: "RBAC",
    hint: "Four-letter acronym.",
  },
  {
    id: "data-overfit",
    category: "Data",
    difficulty: "Medium",
    prompt: "Model quality",
    sentenceParts: ["When a model performs well on training data but poorly on unseen data, it is ", "."],
    answer: "overfitting",
    hint: "Starts with 'over'.",
  },
  {
    id: "design-wcag",
    category: "Design",
    difficulty: "Easy",
    prompt: "Accessibility",
    sentenceParts: ["Accessibility standards for web design are often referred to as ", "."],
    answer: "WCAG",
    hint: "4-letter acronym.",
  },
  {
    id: "pm-rice",
    category: "PM",
    difficulty: "Hard",
    prompt: "Prioritization",
    sentenceParts: ["A product prioritization framework based on Reach, Impact, Confidence, and Effort is ", "."],
    answer: "RICE",
    hint: "It is also a food grain.",
  },
  {
    id: "hr-star",
    category: "General HR",
    difficulty: "Easy",
    prompt: "Behavioral interviews",
    sentenceParts: ["A common storytelling structure for behavioral answers is the ", " method."],
    answer: "STAR",
    hint: "Situation, Task, Action, Result.",
  },
];

function normalizeBlankAnswer(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

const INTERVIEW_PREP_STORAGE_KEY = "hireflow_interview_prep_progress_v1";

type PersistedInterviewPrepState = {
  category: Category;
  difficulty: Difficulty;
  activeModule: PrepModule;
  ratings: Record<QuestionKey, number>;
  notes: Record<QuestionKey, string>;
  answers: Record<QuestionKey, string>;
  doneMap: Record<QuestionKey, boolean>;
  quizQuestionCount: number;
  quizSecondsPerQuestion: number;
  selectedChallengeId: string;
  codeLanguage: CodeLanguage;
  codeDrafts: Record<string, string>;
  blankItemCount: number;
  blankSecondsPerItem: number;
  quizHistory: ModuleMetric[];
  blankHistory: ModuleMetric[];
  codeCheckHistory: Array<{ ts: number; passed: number; total: number }>;
};

function loadPersistedInterviewPrepState(): PersistedInterviewPrepState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(INTERVIEW_PREP_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedInterviewPrepState;
  } catch {
    window.localStorage.removeItem(INTERVIEW_PREP_STORAGE_KEY);
    return null;
  }
}

function challengeCodeKey(challengeId: string, language: CodeLanguage) {
  return `${challengeId}::${language}`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildQuestions(category: Category, difficulty: Difficulty): Question[] {
  const pool = QUESTIONS[category] ?? [];
  if (difficulty === "Easy") return pool.filter((q) => q.type === "HR").slice(0, 8);
  if (difficulty === "Hard") return pool.filter((q) => q.type !== "HR").slice(0, 8);
  return pool.slice(0, 8);
}

function ConfidenceStars({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex gap-0.5" role="group" aria-label="Confidence rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="text-sm transition-transform hover:scale-125"
          aria-label={`Set confidence to ${star} out of 5`}
          aria-pressed={value >= star}
        >
          {value >= star ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}

function PracticeQuestionCard({
  question,
  rating,
  note,
  answer,
  done,
  showTip,
  showNotes,
  onRatingChange,
  onAnswerChange,
  onNoteChange,
  onToggleTip,
  onToggleNotes,
  onToggleDone,
}: {
  question: Question;
  rating: number;
  note: string;
  answer: string;
  done: boolean;
  showTip: boolean;
  showNotes: boolean;
  onRatingChange: (value: number) => void;
  onAnswerChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onToggleTip: () => void;
  onToggleNotes: () => void;
  onToggleDone: () => void;
}) {
  return (
    <Card className={done ? "space-y-3 border-[var(--color-success)]/50 p-5" : "space-y-3 p-5"}>
      <div className="flex items-center justify-between gap-2">
        <Badge variant={question.type === "Technical" ? "blue" : question.type === "Behavioral" ? "purple" : "amber"}>
          {question.type}
        </Badge>
        <ConfidenceStars value={rating} onChange={onRatingChange} />
      </div>

      <p className="text-sm font-semibold text-[var(--text)]">{question.q}</p>

      <textarea
        className="input-base w-full text-xs"
        rows={3}
        placeholder="Write your answer draft..."
        value={answer}
        onChange={(event) => onAnswerChange(event.target.value)}
      />

      <div className="flex flex-wrap gap-2">
        <button type="button" className="text-xs text-[var(--accent)] hover:underline" onClick={onToggleTip}>
          {showTip ? "Hide Tip" : "Show Tip"}
        </button>
        <button type="button" className="text-xs text-[var(--accent)] hover:underline" onClick={onToggleNotes}>
          {showNotes ? "Hide Notes" : "Add Notes"}
        </button>
        <button type="button" className="text-xs text-[var(--accent)] hover:underline" onClick={onToggleDone}>
          {done ? "Mark As Incomplete" : "Mark As Done"}
        </button>
      </div>

      {showTip ? (
        <div className="animate-fade-in rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-3 text-xs text-[var(--text-secondary)]">
          💡 {question.tip}
        </div>
      ) : null}

      {showNotes ? (
        <textarea
          className="input-base w-full text-xs animate-fade-in"
          rows={2}
          placeholder="Add follow-up notes..."
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
        />
      ) : null}
    </Card>
  );
}

/* ─── Main page ─── */
export function InterviewPrepPage() {
  const persistedState = useMemo(() => loadPersistedInterviewPrepState(), []);
  const initialCategory: Category = persistedState?.category ?? "Frontend";
  const initialDifficulty: Difficulty = persistedState?.difficulty ?? "Medium";
  const initialChallengeId =
    persistedState?.selectedChallengeId && CODING_CHALLENGES.some((challenge) => challenge.id === persistedState.selectedChallengeId)
      ? persistedState.selectedChallengeId
      : CODING_CHALLENGES[0].id;
  const [category, setCategory] = useState<Category>(initialCategory);
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);
  const [activeModule, setActiveModule] = useState<PrepModule>(persistedState?.activeModule ?? "PRACTICE");
  const [questions, setQuestions] = useState<Question[]>(() => buildQuestions(initialCategory, initialDifficulty));
  const [ratings, setRatings] = useState<Record<QuestionKey, number>>(persistedState?.ratings ?? {});
  const [showTip, setShowTip] = useState<Record<QuestionKey, boolean>>({});
  const [showNotes, setShowNotes] = useState<Record<QuestionKey, boolean>>({});
  const [notes, setNotes] = useState<Record<QuestionKey, string>>(persistedState?.notes ?? {});
  const [answers, setAnswers] = useState<Record<QuestionKey, string>>(persistedState?.answers ?? {});
  const [doneMap, setDoneMap] = useState<Record<QuestionKey, boolean>>(persistedState?.doneMap ?? {});
  const [mockIdx, setMockIdx] = useState(0);
  const [timer, setTimer] = useState(120);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [quizStatus, setQuizStatus] = useState<"idle" | "running" | "finished">("idle");
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSecondsPerQuestion, setQuizSecondsPerQuestion] = useState(persistedState?.quizSecondsPerQuestion ?? 60);
  const [quizQuestionCount, setQuizQuestionCount] = useState(persistedState?.quizQuestionCount ?? 6);
  const [quizTimer, setQuizTimer] = useState(60);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizConfidence, setQuizConfidence] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<Record<number, boolean>>({});
  const quizTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [selectedChallengeId, setSelectedChallengeId] = useState(initialChallengeId);
  const [codeLanguage, setCodeLanguage] = useState<CodeLanguage>(persistedState?.codeLanguage ?? "javascript");
  const [challengeTimer, setChallengeTimer] = useState(25 * 60);
  const [challengeTimerRunning, setChallengeTimerRunning] = useState(false);
  const challengeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const challenge of CODING_CHALLENGES) {
      initial[challengeCodeKey(challenge.id, "javascript")] = challenge.starterCode.javascript;
      initial[challengeCodeKey(challenge.id, "python")] = challenge.starterCode.python;
    }
    if (persistedState?.codeDrafts) {
      return { ...initial, ...persistedState.codeDrafts };
    }
    return initial;
  });
  const [runOutput, setRunOutput] = useState<string[]>([]);
  const [checkResult, setCheckResult] = useState<{ passed: number; total: number; details: string[] } | null>(null);
  const [blankStatus, setBlankStatus] = useState<"idle" | "running" | "finished">("idle");
  const [blankItems, setBlankItems] = useState<BlankChallenge[]>([]);
  const [blankIndex, setBlankIndex] = useState(0);
  const [blankAnswerInput, setBlankAnswerInput] = useState("");
  const [blankSecondsPerItem, setBlankSecondsPerItem] = useState(persistedState?.blankSecondsPerItem ?? 35);
  const [blankItemCount, setBlankItemCount] = useState(persistedState?.blankItemCount ?? 6);
  const [blankTimer, setBlankTimer] = useState(35);
  const [blankResponses, setBlankResponses] = useState<Record<number, { answer: string; correct: boolean; skipped: boolean }>>({});
  const blankTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [quizHistory, setQuizHistory] = useState<ModuleMetric[]>(persistedState?.quizHistory ?? []);
  const [blankHistory, setBlankHistory] = useState<ModuleMetric[]>(persistedState?.blankHistory ?? []);
  const [codeCheckHistory, setCodeCheckHistory] = useState<Array<{ ts: number; passed: number; total: number }>>(persistedState?.codeCheckHistory ?? []);
  const quizLoggedRef = useRef(false);
  const blankLoggedRef = useRef(false);
  const quizFinishScheduledRef = useRef(false);
  const blankFinishScheduledRef = useRef(false);

  const resetPracticeState = useCallback(() => {
    setShowTip({});
    setShowNotes({});
    setMockIdx(0);
    setTimer(120);
  }, []);

  const onCategoryChange = useCallback((nextCategory: Category) => {
    setCategory(nextCategory);
    setQuestions(buildQuestions(nextCategory, difficulty));
    resetPracticeState();
  }, [difficulty, resetPracticeState]);

  const onDifficultyChange = useCallback((nextDifficulty: Difficulty) => {
    setDifficulty(nextDifficulty);
    setQuestions(buildQuestions(category, nextDifficulty));
    resetPracticeState();
  }, [category, resetPracticeState]);

  const startMockSession = useCallback(() => {
    setActiveModule("MOCK");
    setTimer(120);
    setMockIdx(0);
  }, []);

  const finishQuiz = useCallback(() => {
    setQuizStatus("finished");
    if (quizTimerRef.current) {
      clearInterval(quizTimerRef.current);
      quizTimerRef.current = null;
    }
    if (!quizLoggedRef.current && quizQuestions.length) {
      const answeredCount = Object.values(quizSubmitted).filter(Boolean).length;
      const submittedEntries = Object.entries(quizSubmitted).filter(([, submitted]) => submitted);
      const confidenceTotal = submittedEntries.reduce((sum, [index]) => sum + (quizConfidence[Number(index)] ?? 0), 0);
      const averageConfidence = submittedEntries.length ? confidenceTotal / submittedEntries.length : 0;
      const completionPart = (answeredCount / quizQuestions.length) * 70;
      const confidencePart = (averageConfidence / 5) * 30;
      const score = Math.round(completionPart + confidencePart);
      setQuizHistory((history) => [...history.slice(-49), { ts: Date.now(), score }]);
      quizLoggedRef.current = true;
    }
  }, [quizConfidence, quizQuestions.length, quizSubmitted]);

  const moveQuizNext = useCallback(() => {
    setQuizIndex((current) => {
      if (current + 1 >= quizQuestions.length) {
        finishQuiz();
        return current;
      }
      setQuizTimer(quizSecondsPerQuestion);
      return current + 1;
    });
  }, [finishQuiz, quizQuestions.length, quizSecondsPerQuestion]);

  const startQuizSession = useCallback(() => {
    const basePool = buildQuestions(category, difficulty);
    const picked = shuffle(basePool).slice(0, Math.max(3, Math.min(10, quizQuestionCount)));
    setQuizQuestions(picked);
    setQuizIndex(0);
    setQuizAnswers({});
    setQuizSubmitted({});
    setQuizConfidence({});
    setQuizTimer(quizSecondsPerQuestion);
    setQuizStatus("running");
    quizLoggedRef.current = false;
    quizFinishScheduledRef.current = false;
    setActiveModule("QUIZ");
  }, [category, difficulty, quizQuestionCount, quizSecondsPerQuestion]);

  const selectedChallenge = useMemo(
    () => CODING_CHALLENGES.find((challenge) => challenge.id === selectedChallengeId) ?? CODING_CHALLENGES[0],
    [selectedChallengeId]
  );

  const activeCodeKey = challengeCodeKey(selectedChallenge.id, codeLanguage);
  const activeCode = codeDrafts[activeCodeKey] ?? selectedChallenge.starterCode[codeLanguage];

  const runCode = useCallback(() => {
    const lines = activeCode.split("\n").length;
    const hasReturn = /\breturn\b/.test(activeCode);
    const hasFunction = /function\s+solve|def\s+solve/.test(activeCode);
    const logs = [
      `Running ${selectedChallenge.title} in ${codeLanguage}...`,
      `Source lines: ${lines}`,
      hasFunction ? "Detected solve() signature." : "Missing solve() signature.",
      hasReturn ? "Return statement found." : "No return statement detected.",
      "Execution simulated locally. Use Check for challenge evaluation.",
    ];
    setRunOutput(logs);
  }, [activeCode, codeLanguage, selectedChallenge.title]);

  const checkCode = useCallback(() => {
    const required = selectedChallenge.requiredSnippets[codeLanguage];
    let passed = 0;
    const details = required.map((snippet) => {
      const ok = activeCode.toLowerCase().includes(snippet.toLowerCase());
      if (ok) passed += 1;
      return `${ok ? "PASS" : "FAIL"}: expects '${snippet}' pattern`;
    });

    setCheckResult({ passed, total: required.length, details });
    setCodeCheckHistory((history) => [...history.slice(-49), { ts: Date.now(), passed, total: required.length }]);
  }, [activeCode, codeLanguage, selectedChallenge]);

  useEffect(() => {
    const payload: PersistedInterviewPrepState = {
      category,
      difficulty,
      activeModule,
      ratings,
      notes,
      answers,
      doneMap,
      quizQuestionCount,
      quizSecondsPerQuestion,
      selectedChallengeId,
      codeLanguage,
      codeDrafts,
      blankItemCount,
      blankSecondsPerItem,
      quizHistory,
      blankHistory,
      codeCheckHistory,
    };

    window.localStorage.setItem(INTERVIEW_PREP_STORAGE_KEY, JSON.stringify(payload));
  }, [
    activeModule,
    answers,
    blankHistory,
    blankItemCount,
    blankSecondsPerItem,
    category,
    codeCheckHistory,
    codeDrafts,
    codeLanguage,
    difficulty,
    doneMap,
    notes,
    quizHistory,
    quizQuestionCount,
    quizSecondsPerQuestion,
    ratings,
    selectedChallengeId,
  ]);

  const finishBlankSession = useCallback(() => {
    setBlankStatus("finished");
    if (blankTimerRef.current) {
      clearInterval(blankTimerRef.current);
      blankTimerRef.current = null;
    }
    if (!blankLoggedRef.current && blankItems.length) {
      const correctCount = Object.values(blankResponses).filter((item) => item.correct).length;
      const score = Math.round((correctCount / blankItems.length) * 100);
      setBlankHistory((history) => [...history.slice(-49), { ts: Date.now(), score }]);
      blankLoggedRef.current = true;
    }
  }, [blankItems.length, blankResponses]);

  const moveBlankNext = useCallback(() => {
    setBlankIndex((current) => {
      if (current + 1 >= blankItems.length) {
        finishBlankSession();
        return current;
      }
      setBlankAnswerInput("");
      setBlankTimer(blankSecondsPerItem);
      return current + 1;
    });
  }, [blankItems.length, blankSecondsPerItem, finishBlankSession]);

  const startBlankSession = useCallback(() => {
    const pool = BLANK_CHALLENGES.filter((item) => item.category === category || item.category === "General HR");
    const filtered = pool.filter((item) => item.difficulty === difficulty || difficulty === "Medium");
    const picked = shuffle(filtered.length ? filtered : BLANK_CHALLENGES).slice(0, Math.max(3, Math.min(8, blankItemCount)));
    setBlankItems(picked);
    setBlankIndex(0);
    setBlankAnswerInput("");
    setBlankResponses({});
    setBlankTimer(blankSecondsPerItem);
    setBlankStatus("running");
    blankLoggedRef.current = false;
    blankFinishScheduledRef.current = false;
    setActiveModule("BLANK");
  }, [blankItemCount, blankSecondsPerItem, category, difficulty]);

  /* Timer for mock mode */
  useEffect(() => {
    if (activeModule !== "MOCK") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (mockIdx >= questions.length) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) { setMockIdx((i) => i + 1); return 120; }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeModule, mockIdx, questions.length]);

  useEffect(() => {
    if (activeModule !== "QUIZ" || quizStatus !== "running") {
      if (quizTimerRef.current) {
        clearInterval(quizTimerRef.current);
        quizTimerRef.current = null;
      }
      return;
    }

    if (!quizQuestions.length || quizIndex >= quizQuestions.length) {
      if (!quizFinishScheduledRef.current) {
        quizFinishScheduledRef.current = true;
        window.setTimeout(() => {
          finishQuiz();
          quizFinishScheduledRef.current = false;
        }, 0);
      }
      return;
    }

    quizTimerRef.current = setInterval(() => {
      setQuizTimer((seconds) => {
        if (seconds <= 1) {
          moveQuizNext();
          return quizSecondsPerQuestion;
        }
        return seconds - 1;
      });
    }, 1000);

    return () => {
      if (quizTimerRef.current) {
        clearInterval(quizTimerRef.current);
        quizTimerRef.current = null;
      }
    };
  }, [activeModule, finishQuiz, moveQuizNext, quizIndex, quizQuestions.length, quizSecondsPerQuestion, quizStatus]);

  useEffect(() => {
    if (activeModule !== "CODE" || !challengeTimerRunning) {
      if (challengeTimerRef.current) {
        clearInterval(challengeTimerRef.current);
        challengeTimerRef.current = null;
      }
      return;
    }

    challengeTimerRef.current = setInterval(() => {
      setChallengeTimer((seconds) => {
        if (seconds <= 1) {
          setChallengeTimerRunning(false);
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);

    return () => {
      if (challengeTimerRef.current) {
        clearInterval(challengeTimerRef.current);
        challengeTimerRef.current = null;
      }
    };
  }, [activeModule, challengeTimerRunning]);

  useEffect(() => {
    if (activeModule !== "BLANK" || blankStatus !== "running") {
      if (blankTimerRef.current) {
        clearInterval(blankTimerRef.current);
        blankTimerRef.current = null;
      }
      return;
    }

    if (!blankItems.length || blankIndex >= blankItems.length) {
      if (!blankFinishScheduledRef.current) {
        blankFinishScheduledRef.current = true;
        window.setTimeout(() => {
          finishBlankSession();
          blankFinishScheduledRef.current = false;
        }, 0);
      }
      return;
    }

    blankTimerRef.current = setInterval(() => {
      setBlankTimer((seconds) => {
        if (seconds <= 1) {
          setBlankResponses((state) => ({
            ...state,
            [blankIndex]: {
              answer: blankAnswerInput,
              correct: false,
              skipped: true,
            },
          }));
          moveBlankNext();
          return blankSecondsPerItem;
        }
        return seconds - 1;
      });
    }, 1000);

    return () => {
      if (blankTimerRef.current) {
        clearInterval(blankTimerRef.current);
        blankTimerRef.current = null;
      }
    };
  }, [activeModule, blankAnswerInput, blankIndex, blankItems, blankSecondsPerItem, blankStatus, finishBlankSession, moveBlankNext]);

  const readiness = useMemo(() => {
    const vals = Object.values(ratings);
    if (vals.length === 0) return 0;
    return Math.round((vals.reduce((a, b) => a + b, 0) / (vals.length * 5)) * 100);
  }, [ratings]);

  const doShuffle = useCallback(() => {
    setQuestions((q) => shuffle(q));
  }, []);

  const reviewItems = useMemo(() => {
    return questions
      .map((question, index) => ({
        question,
        index,
        key: questionKey(category, difficulty, question.q),
      }))
      .map((item) => ({
        ...item,
        answer: answers[item.key]?.trim() ?? "",
        note: notes[item.key]?.trim() ?? "",
        rating: ratings[item.key] ?? 0,
        done: Boolean(doneMap[item.key]),
      }))
      .filter((item) => hasProgressSignal({ answer: item.answer, note: item.note, rating: item.rating, done: item.done }))
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        if ((a.rating || 0) !== (b.rating || 0)) return (a.rating || 0) - (b.rating || 0);
        return a.index - b.index;
      });
  }, [answers, category, difficulty, doneMap, notes, questions, ratings]);

  const currentQuestionKeys = useMemo(
    () => questions.map((q) => questionKey(category, difficulty, q.q)),
    [category, difficulty, questions]
  );

  const completedCount = useMemo(
    () => currentQuestionKeys.filter((key) => doneMap[key]).length,
    [currentQuestionKeys, doneMap]
  );

  const attemptedCount = useMemo(
    () =>
      currentQuestionKeys.filter((key) =>
        hasProgressSignal({ answer: answers[key], note: notes[key], rating: ratings[key], done: doneMap[key] })
      ).length,
    [answers, currentQuestionKeys, doneMap, notes, ratings]
  );

  const categoryProgress = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const categoryQuestions = buildQuestions(cat, difficulty);
      const keys = categoryQuestions.map((q) => questionKey(cat, difficulty, q.q));
      const attempted = keys.filter((key) =>
        hasProgressSignal({ answer: answers[key], note: notes[key], rating: ratings[key], done: doneMap[key] })
      ).length;
      const done = keys.filter((key) => doneMap[key]).length;
      return {
        category: cat,
        total: keys.length,
        attempted,
        done,
        percent: keys.length ? Math.round((done / keys.length) * 100) : 0,
      };
    });
  }, [answers, difficulty, doneMap, notes, ratings]);

  const fmtTimer = `${String(Math.floor(timer / 60)).padStart(2, "0")}:${String(timer % 60).padStart(2, "0")}`;
  const fmtQuizTimer = `${String(Math.floor(quizTimer / 60)).padStart(2, "0")}:${String(quizTimer % 60).padStart(2, "0")}`;
  const fmtChallengeTimer = `${String(Math.floor(challengeTimer / 60)).padStart(2, "0")}:${String(challengeTimer % 60).padStart(2, "0")}`;

  const quizAnsweredCount = useMemo(
    () => Object.values(quizSubmitted).filter(Boolean).length,
    [quizSubmitted]
  );

  const quizSkippedCount = useMemo(
    () => Math.max(0, quizQuestions.length - quizAnsweredCount),
    [quizAnsweredCount, quizQuestions.length]
  );

  const quizAverageConfidence = useMemo(() => {
    const entries = Object.entries(quizSubmitted).filter(([, submitted]) => submitted);
    if (entries.length === 0) return 0;
    const total = entries.reduce((sum, [index]) => sum + (quizConfidence[Number(index)] ?? 0), 0);
    return Math.round((total / entries.length) * 10) / 10;
  }, [quizConfidence, quizSubmitted]);

  const quizScore = useMemo(() => {
    if (!quizQuestions.length) return 0;
    const completionPart = (quizAnsweredCount / quizQuestions.length) * 70;
    const confidencePart = (quizAverageConfidence / 5) * 30;
    return Math.round(completionPart + confidencePart);
  }, [quizAnsweredCount, quizAverageConfidence, quizQuestions.length]);

  const blankCorrectCount = useMemo(
    () => Object.values(blankResponses).filter((item) => item.correct).length,
    [blankResponses]
  );

  const blankSkippedCount = useMemo(
    () => Object.values(blankResponses).filter((item) => item.skipped).length,
    [blankResponses]
  );

  const blankAttemptedCount = useMemo(
    () => Object.keys(blankResponses).length,
    [blankResponses]
  );

  const blankScore = useMemo(() => {
    if (!blankItems.length) return 0;
    return Math.round((blankCorrectCount / blankItems.length) * 100);
  }, [blankCorrectCount, blankItems.length]);

  const practiceCompletionRate = useMemo(() => {
    if (!questions.length) return 0;
    return Math.round((completedCount / questions.length) * 100);
  }, [completedCount, questions.length]);

  const avgQuizScore = useMemo(() => {
    if (!quizHistory.length) return 0;
    const total = quizHistory.reduce((sum, item) => sum + item.score, 0);
    return Math.round(total / quizHistory.length);
  }, [quizHistory]);

  const avgBlankScore = useMemo(() => {
    if (!blankHistory.length) return 0;
    const total = blankHistory.reduce((sum, item) => sum + item.score, 0);
    return Math.round(total / blankHistory.length);
  }, [blankHistory]);

  const codeCheckPassRate = useMemo(() => {
    if (!codeCheckHistory.length) return 0;
    const totals = codeCheckHistory.reduce(
      (acc, item) => ({ passed: acc.passed + item.passed, total: acc.total + item.total }),
      { passed: 0, total: 0 }
    );
    if (!totals.total) return 0;
    return Math.round((totals.passed / totals.total) * 100);
  }, [codeCheckHistory]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">Interview Prep</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Practice questions, rate your confidence, and run mock sessions.</p>
          </div>
          {readiness > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--muted)]">Readiness</span>
              <div className="relative h-10 w-10">
                <svg viewBox="0 0 36 36" className="h-10 w-10">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border)" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15" fill="none"
                    stroke={readiness >= 70 ? "#22c55e" : readiness >= 40 ? "#f59e0b" : "#ef4444"}
                    strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={`${readiness * 0.94} 100`}
                    transform="rotate(-90 18 18)"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[var(--text)]">{readiness}%</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
          {[
            { key: "PRACTICE" as const, label: "Practice Questions" },
            { key: "MOCK" as const, label: "Mock Drill" },
            { key: "QUIZ" as const, label: "Timed Quiz" },
            { key: "CODE" as const, label: "Coding Challenge" },
            { key: "BLANK" as const, label: "Fill In The Blank" },
            { key: "REVIEW" as const, label: "Review Notes" },
          ].map((module) => (
            <button
              key={module.key}
              type="button"
              onClick={() => setActiveModule(module.key)}
              aria-pressed={activeModule === module.key}
              className={
                activeModule === module.key
                  ? "rounded-lg border border-[var(--color-accent)] bg-[color:color-mix(in_srgb,var(--color-accent)_18%,transparent)] px-3 py-1.5 text-xs font-semibold text-text"
                  : "rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text"
              }
            >
              {module.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Controls */}
      <Card className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="text-xs text-[var(--muted)] block mb-1">Category</label>
          <select className="input-base w-full" value={category} onChange={(e) => onCategoryChange(e.target.value as Category)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[120px]">
          <label className="text-xs text-[var(--muted)] block mb-1">Difficulty</label>
          <select className="input-base w-full" value={difficulty} onChange={(e) => onDifficultyChange(e.target.value as Difficulty)}>
            <option>Easy</option><option>Medium</option><option>Hard</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={doShuffle}>Shuffle</Button>
          <Button variant="primary" onClick={startMockSession}>Start Mock</Button>
          <Button variant="secondary" onClick={startQuizSession}>Start Quiz</Button>
          <Button variant="secondary" onClick={startBlankSession}>Start Blank</Button>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-text">Practice Progress</p>
            <p className="text-xs text-text-muted">{attemptedCount}/{questions.length} attempted • {completedCount}/{questions.length} completed</p>
          </div>
          <div className="rounded-full border border-border px-3 py-1 text-xs text-text-secondary">
            {questions.length ? Math.round((completedCount / questions.length) * 100) : 0}% complete
          </div>
        </div>
        <div className="h-2 w-full rounded-full bg-surface-raised">
          <div
            className="h-2 rounded-full bg-[linear-gradient(90deg,var(--color-accent),var(--color-accent-hover))]"
            style={{ width: `${questions.length ? Math.round((completedCount / questions.length) * 100) : 0}%` }}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {categoryProgress.map((item) => (
            <button
              key={item.category}
              type="button"
              onClick={() => onCategoryChange(item.category)}
              aria-pressed={category === item.category}
              className="rounded-xl border border-border bg-surface p-3 text-left hover:border-[var(--color-accent)]/50"
            >
              <p className="text-xs font-semibold text-text">{item.category}</p>
              <p className="mt-1 text-xs text-text-muted">{item.done}/{item.total} done • {item.attempted}/{item.total} attempted</p>
            </button>
          ))}
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-text">Saved Progress Metrics</p>
            <p className="text-xs text-text-muted">Metrics persist between sessions on this browser.</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setRatings({});
              setNotes({});
              setAnswers({});
              setDoneMap({});
              setQuizHistory([]);
              setBlankHistory([]);
              setCodeCheckHistory([]);
              window.localStorage.removeItem(INTERVIEW_PREP_STORAGE_KEY);
            }}
          >
            Reset Saved Progress
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-xs text-text-muted">Practice completion</p>
            <p className="text-xl font-semibold text-text">{practiceCompletionRate}%</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-xs text-text-muted">Avg quiz score</p>
            <p className="text-xl font-semibold text-text">{avgQuizScore}%</p>
            <p className="text-xs text-text-muted">{quizHistory.length} sessions</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-xs text-text-muted">Avg blanks score</p>
            <p className="text-xl font-semibold text-text">{avgBlankScore}%</p>
            <p className="text-xs text-text-muted">{blankHistory.length} rounds</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="text-xs text-text-muted">Code check pass rate</p>
            <p className="text-xl font-semibold text-text">{codeCheckPassRate}%</p>
            <p className="text-xs text-text-muted">{codeCheckHistory.length} checks</p>
          </div>
        </div>
      </Card>

      {/* Mock mode */}
      {activeModule === "MOCK" ? (
        <div className="space-y-4">
          {mockIdx < questions.length ? (
            <Card className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <Badge variant={questions[mockIdx].type === "Technical" ? "blue" : questions[mockIdx].type === "Behavioral" ? "purple" : "amber"}>
                  {questions[mockIdx].type}
                </Badge>
                <div className={`text-lg font-mono font-bold ${timer < 30 ? "text-[#ef4444] animate-pulse" : "text-[var(--text)]"}`}>
                  {fmtTimer}
                </div>
              </div>
              <p className="text-lg font-semibold text-[var(--text)]">{questions[mockIdx].q}</p>
              <div className="flex gap-2">
                <span className="text-xs text-[var(--muted)]">Question {mockIdx + 1} of {questions.length}</span>
              </div>
              <Button variant="secondary" onClick={() => { setMockIdx((i) => i + 1); setTimer(120); }}>
                Next Question →
              </Button>
            </Card>
          ) : (
            <Card className="text-center py-8">
              <div className="text-3xl mb-2">🎉</div>
              <h3 className="text-sm font-semibold text-[var(--text)]">Mock session complete!</h3>
              <p className="text-xs text-[var(--muted)] mt-1">{questions.length} questions answered.</p>
              <Button variant="primary" className="mt-4" onClick={() => setActiveModule("PRACTICE")}>Back to Practice</Button>
            </Card>
          )}
        </div>
      ) : activeModule === "QUIZ" ? (
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-xs text-text-muted">
                Questions per quiz
                <input
                  type="number"
                  min={3}
                  max={10}
                  value={quizQuestionCount}
                  onChange={(event) => setQuizQuestionCount(Math.max(3, Math.min(10, Number(event.target.value) || 6)))}
                  className="input-base w-full"
                  disabled={quizStatus === "running"}
                />
              </label>
              <label className="space-y-1 text-xs text-text-muted">
                Seconds per question
                <input
                  type="number"
                  min={20}
                  max={180}
                  value={quizSecondsPerQuestion}
                  onChange={(event) => setQuizSecondsPerQuestion(Math.max(20, Math.min(180, Number(event.target.value) || 60)))}
                  className="input-base w-full"
                  disabled={quizStatus === "running"}
                />
              </label>
              <div className="flex items-end gap-2">
                <Button variant="primary" onClick={startQuizSession} disabled={quizStatus === "running"}>Start New Quiz</Button>
              </div>
            </div>
          </Card>

          {quizStatus === "running" && quizQuestions[quizIndex] ? (
            <Card className="space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant={quizQuestions[quizIndex].type === "Technical" ? "blue" : quizQuestions[quizIndex].type === "Behavioral" ? "purple" : "amber"}>
                  {quizQuestions[quizIndex].type}
                </Badge>
                <div className={`text-lg font-mono font-bold ${quizTimer <= 15 ? "text-danger" : "text-text"}`}>{fmtQuizTimer}</div>
              </div>

              <p className="text-lg font-semibold text-text">{quizQuestions[quizIndex].q}</p>
              <p className="text-xs text-text-muted">Question {quizIndex + 1} of {quizQuestions.length}</p>

              <textarea
                rows={4}
                className="input-base w-full"
                placeholder="Type your answer before time runs out..."
                value={quizAnswers[quizIndex] ?? ""}
                onChange={(event) => setQuizAnswers((state) => ({ ...state, [quizIndex]: event.target.value }))}
              />

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-text-muted">Confidence</span>
                <ConfidenceStars
                  value={quizConfidence[quizIndex] ?? 0}
                  onChange={(value) => setQuizConfidence((state) => ({ ...state, [quizIndex]: value }))}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  onClick={() => {
                    setQuizSubmitted((state) => ({ ...state, [quizIndex]: Boolean((quizAnswers[quizIndex] ?? "").trim()) }));
                    moveQuizNext();
                  }}
                >
                  Submit & Next
                </Button>
                <Button variant="secondary" onClick={moveQuizNext}>Skip</Button>
              </div>
            </Card>
          ) : null}

          {quizStatus === "finished" ? (
            <Card className="space-y-4 p-6">
              <div>
                <h3 className="text-lg font-semibold text-text">Quiz Summary</h3>
                <p className="text-sm text-text-muted">Timed session completed for {category} ({difficulty}).</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-text-muted">Score</p>
                  <p className="text-xl font-semibold text-text">{quizScore}%</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-text-muted">Answered</p>
                  <p className="text-xl font-semibold text-text">{quizAnsweredCount}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-text-muted">Skipped</p>
                  <p className="text-xl font-semibold text-text">{quizSkippedCount}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-text-muted">Avg confidence</p>
                  <p className="text-xl font-semibold text-text">{quizAverageConfidence}/5</p>
                </div>
              </div>

              <div className="space-y-2">
                {quizQuestions.map((question, index) => (
                  <div key={`${question.q}-${index}`} className="rounded-lg border border-border bg-surface p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-text">{index + 1}. {question.q}</p>
                      <span className="text-xs text-text-muted">{quizSubmitted[index] ? "Answered" : "Skipped"}</span>
                    </div>
                    {quizAnswers[index] ? <p className="mt-1 text-xs text-text-secondary">{quizAnswers[index]}</p> : null}
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Button variant="primary" onClick={startQuizSession}>Retake Quiz</Button>
                <Button variant="secondary" onClick={() => setActiveModule("PRACTICE")}>Back To Practice</Button>
              </div>
            </Card>
          ) : null}
        </div>
      ) : activeModule === "CODE" ? (
        <div className="grid gap-4 lg:grid-cols-[1.05fr_1.2fr]">
          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-text">Challenge Bank</h3>
              <div className={`rounded-full border px-2 py-1 text-xs ${challengeTimer <= 120 ? "border-danger/60 text-danger" : "border-border text-text-secondary"}`}>
                {fmtChallengeTimer}
              </div>
            </div>

            <div className="space-y-2">
              {CODING_CHALLENGES.map((challenge) => (
                <button
                  key={challenge.id}
                  type="button"
                  onClick={() => {
                    setSelectedChallengeId(challenge.id);
                    setRunOutput([]);
                    setCheckResult(null);
                  }}
                  aria-pressed={selectedChallengeId === challenge.id}
                  className={
                    selectedChallengeId === challenge.id
                      ? "w-full rounded-xl border border-[var(--color-accent)] bg-[color:color-mix(in_srgb,var(--color-accent)_14%,transparent)] p-3 text-left"
                      : "w-full rounded-xl border border-border bg-surface p-3 text-left hover:border-[var(--color-accent)]/40"
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-text">{challenge.title}</p>
                    <Badge variant={challenge.difficulty === "Easy" ? "teal" : challenge.difficulty === "Medium" ? "amber" : "purple"}>
                      {challenge.difficulty}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">{challenge.tags.join(" • ")}</p>
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-border bg-surface-raised p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Problem</p>
              <p className="mt-2 text-sm text-text-secondary">{selectedChallenge.prompt}</p>
              <div className="mt-3 space-y-1">
                <p className="text-xs font-semibold text-text-muted">Example</p>
                <p className="text-xs text-text">Input: {selectedChallenge.exampleInput}</p>
                <p className="text-xs text-text">Output: {selectedChallenge.exampleOutput}</p>
              </div>
              <ul className="mt-3 space-y-1 text-xs text-text-secondary">
                {selectedChallenge.constraints.map((constraint) => (
                  <li key={constraint}>- {constraint}</li>
                ))}
              </ul>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                {(["javascript", "python"] as CodeLanguage[]).map((language) => (
                  <button
                    key={language}
                    type="button"
                    onClick={() => setCodeLanguage(language)}
                    aria-pressed={codeLanguage === language}
                    className={
                      codeLanguage === language
                        ? "rounded-lg border border-[var(--color-accent)] bg-[color:color-mix(in_srgb,var(--color-accent)_14%,transparent)] px-3 py-1.5 text-xs font-semibold text-text"
                        : "rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-text-secondary"
                    }
                  >
                    {language === "javascript" ? "JavaScript" : "Python"}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setChallengeTimerRunning((value) => !value)}
                >
                  {challengeTimerRunning ? "Pause Timer" : "Start Timer"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setChallengeTimer(25 * 60);
                    setChallengeTimerRunning(false);
                  }}
                >
                  Reset Timer
                </Button>
              </div>
            </div>

            <textarea
              className="min-h-[340px] w-full rounded-xl border border-border bg-surface px-3 py-3 font-mono text-sm text-text outline-none focus:border-[var(--color-accent)]"
              value={activeCode}
              onChange={(event) =>
                setCodeDrafts((state) => ({
                  ...state,
                  [activeCodeKey]: event.target.value,
                }))
              }
            />

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={runCode}>Run</Button>
              <Button variant="primary" onClick={checkCode}>Check</Button>
              <Button
                variant="secondary"
                onClick={() =>
                  setCodeDrafts((state) => ({
                    ...state,
                    [activeCodeKey]: selectedChallenge.starterCode[codeLanguage],
                  }))
                }
              >
                Reset Code
              </Button>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-surface-raised p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Run Output</p>
                {runOutput.length ? (
                  <div className="mt-2 space-y-1 text-xs text-text-secondary">
                    {runOutput.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-text-muted">Run your code to see simulated execution output.</p>
                )}
              </div>

              <div className="rounded-xl border border-border bg-surface-raised p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Check Result</p>
                {checkResult ? (
                  <>
                    <p className="mt-2 text-sm font-semibold text-text">{checkResult.passed}/{checkResult.total} checks passed</p>
                    <div className="mt-2 space-y-1 text-xs text-text-secondary">
                      {checkResult.details.map((line) => (
                        <p key={line}>{line}</p>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-text-muted">Use Check to validate solution patterns for this challenge.</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      ) : activeModule === "BLANK" ? (
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-xs text-text-muted">
                Blanks per round
                <input
                  type="number"
                  min={3}
                  max={8}
                  value={blankItemCount}
                  onChange={(event) => setBlankItemCount(Math.max(3, Math.min(8, Number(event.target.value) || 6)))}
                  className="input-base w-full"
                  disabled={blankStatus === "running"}
                />
              </label>
              <label className="space-y-1 text-xs text-text-muted">
                Seconds per blank
                <input
                  type="number"
                  min={15}
                  max={90}
                  value={blankSecondsPerItem}
                  onChange={(event) => setBlankSecondsPerItem(Math.max(15, Math.min(90, Number(event.target.value) || 35)))}
                  className="input-base w-full"
                  disabled={blankStatus === "running"}
                />
              </label>
              <div className="flex items-end gap-2">
                <Button variant="primary" onClick={startBlankSession} disabled={blankStatus === "running"}>Start Round</Button>
              </div>
            </div>
          </Card>

          {blankStatus === "running" && blankItems[blankIndex] ? (
            <Card className="space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant={blankItems[blankIndex].difficulty === "Easy" ? "teal" : blankItems[blankIndex].difficulty === "Medium" ? "amber" : "purple"}>
                  {blankItems[blankIndex].difficulty}
                </Badge>
                <div className={`text-lg font-mono font-bold ${blankTimer <= 10 ? "text-danger" : "text-text"}`}>
                  {`${String(Math.floor(blankTimer / 60)).padStart(2, "0")}:${String(blankTimer % 60).padStart(2, "0")}`}
                </div>
              </div>

              <p className="text-xs uppercase tracking-[0.16em] text-text-muted">{blankItems[blankIndex].prompt}</p>
              <p className="text-base font-medium text-text">
                {blankItems[blankIndex].sentenceParts[0]}
                <span className="mx-1 inline-block min-w-[120px] rounded-md border-b border-dashed border-[var(--color-accent)] px-1 py-0.5 text-center text-[var(--color-accent)]">
                  {blankAnswerInput || "_____"}
                </span>
                {blankItems[blankIndex].sentenceParts[1]}
              </p>

              <input
                className="input-base w-full"
                placeholder="Type the missing word"
                value={blankAnswerInput}
                onChange={(event) => setBlankAnswerInput(event.target.value)}
              />

              <p className="text-xs text-text-muted">Hint: {blankItems[blankIndex].hint}</p>
              <p className="text-xs text-text-muted">Blank {blankIndex + 1} of {blankItems.length}</p>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="primary"
                  onClick={() => {
                    const item = blankItems[blankIndex];
                    const correct = normalizeBlankAnswer(blankAnswerInput) === normalizeBlankAnswer(item.answer);
                    setBlankResponses((state) => ({
                      ...state,
                      [blankIndex]: {
                        answer: blankAnswerInput,
                        correct,
                        skipped: false,
                      },
                    }));
                    moveBlankNext();
                  }}
                >
                  Submit & Next
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setBlankResponses((state) => ({
                      ...state,
                      [blankIndex]: {
                        answer: blankAnswerInput,
                        correct: false,
                        skipped: true,
                      },
                    }));
                    moveBlankNext();
                  }}
                >
                  Skip
                </Button>
              </div>
            </Card>
          ) : null}

          {blankStatus === "finished" ? (
            <Card className="space-y-4 p-6">
              <div>
                <h3 className="text-lg font-semibold text-text">Fill-In-The-Blank Summary</h3>
                <p className="text-sm text-text-muted">Category-aware vocabulary and concept recall round completed.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-text-muted">Score</p>
                  <p className="text-xl font-semibold text-text">{blankScore}%</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-text-muted">Correct</p>
                  <p className="text-xl font-semibold text-text">{blankCorrectCount}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-text-muted">Attempted</p>
                  <p className="text-xl font-semibold text-text">{blankAttemptedCount}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-3">
                  <p className="text-xs text-text-muted">Skipped</p>
                  <p className="text-xl font-semibold text-text">{blankSkippedCount}</p>
                </div>
              </div>

              <div className="space-y-2">
                {blankItems.map((item, index) => {
                  const response = blankResponses[index];
                  return (
                    <div key={item.id} className="rounded-lg border border-border bg-surface p-3">
                      <p className="text-sm font-semibold text-text">{index + 1}. {item.prompt}</p>
                      <p className="mt-1 text-xs text-text-secondary">
                        Your answer: {response?.answer?.trim() ? response.answer : "(empty)"}
                      </p>
                      <p className="text-xs text-text-muted">Expected: {item.answer}</p>
                      <p className={`mt-1 text-xs ${response?.correct ? "text-[var(--color-success)]" : "text-danger"}`}>
                        {response?.correct ? "Correct" : response?.skipped ? "Skipped" : "Incorrect"}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2">
                <Button variant="primary" onClick={startBlankSession}>Try Another Round</Button>
                <Button variant="secondary" onClick={() => setActiveModule("PRACTICE")}>Back To Practice</Button>
              </div>
            </Card>
          ) : null}
        </div>
      ) : activeModule === "PRACTICE" ? (
        /* Regular question cards */
        <div className="grid gap-4 sm:grid-cols-2">
          {questions.map((q) => (
            <PracticeQuestionCard
              key={q.q}
              question={q}
              rating={ratings[questionKey(category, difficulty, q.q)] ?? 0}
              note={notes[questionKey(category, difficulty, q.q)] ?? ""}
              answer={answers[questionKey(category, difficulty, q.q)] ?? ""}
              done={Boolean(doneMap[questionKey(category, difficulty, q.q)])}
              showTip={Boolean(showTip[questionKey(category, difficulty, q.q)])}
              showNotes={Boolean(showNotes[questionKey(category, difficulty, q.q)])}
              onRatingChange={(value) => setRatings((state) => ({ ...state, [questionKey(category, difficulty, q.q)]: value }))}
              onAnswerChange={(value) => setAnswers((state) => ({ ...state, [questionKey(category, difficulty, q.q)]: value }))}
              onNoteChange={(value) => setNotes((state) => ({ ...state, [questionKey(category, difficulty, q.q)]: value }))}
              onToggleTip={() =>
                setShowTip((state) => ({
                  ...state,
                  [questionKey(category, difficulty, q.q)]: !state[questionKey(category, difficulty, q.q)],
                }))
              }
              onToggleNotes={() =>
                setShowNotes((state) => ({
                  ...state,
                  [questionKey(category, difficulty, q.q)]: !state[questionKey(category, difficulty, q.q)],
                }))
              }
              onToggleDone={() =>
                setDoneMap((state) => ({
                  ...state,
                  [questionKey(category, difficulty, q.q)]: !state[questionKey(category, difficulty, q.q)],
                }))
              }
            />
          ))}
        </div>
      ) : (
        <Card className="space-y-4 p-5">
          <div>
            <h3 className="text-base font-semibold text-[var(--text)]">Review Notes</h3>
            <p className="text-sm text-[var(--muted)]">Your saved notes and low-confidence questions appear here for focused revision.</p>
          </div>

          {reviewItems.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface-raised p-4 text-sm text-text-secondary">
              Add notes or set confidence ratings in Practice Questions to build your review queue.
            </div>
          ) : (
            <div className="space-y-3">
              {reviewItems.map((item) => (
                <div key={`${item.index}-${item.question.q}`} className="rounded-xl border border-border bg-surface p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <Badge variant={item.question.type === "Technical" ? "blue" : item.question.type === "Behavioral" ? "purple" : "amber"}>
                      {item.question.type}
                    </Badge>
                    <span className="text-xs text-text-muted">Confidence: {item.rating || "Not rated"}/5 {item.done ? "• Done" : ""}</span>
                  </div>
                  <p className="text-sm font-semibold text-text">{item.question.q}</p>
                  {item.answer ? <p className="mt-2 text-sm text-text">{item.answer}</p> : null}
                  {item.note ? <p className="mt-2 text-sm text-text-secondary">{item.note}</p> : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
