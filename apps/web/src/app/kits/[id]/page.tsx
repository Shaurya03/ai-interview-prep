"use client";

import { useEffect, useState, type DragEvent, type KeyboardEvent } from "react";
import { useParams, useRouter } from "next/navigation";

const API_URL = "http://localhost:4000";

type Requirement = {
  id: string;
  text: string;
  kind: "technical" | "behavioural" | "domain";
  priority: "must" | "nice";
};

type Question = {
  id: string;
  requirement_ids: string[];
  category:
  | "technical"
  | "behavioural"
  | "system-design"
  | "company-fit";
  prompt: string;
  answer_outline: string;
  difficulty: number;
};

type Flashcard = {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
};

type ScheduleDay = {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
};

type GeneratedKit = {
  source: {
    company: string;
    company_url: string;
    role: string;
    location: string;
    jd_chars: number;
    researched_at: string;
    pages_used: string[];
  };

  company_brief: {
    summary: string;
    what_they_do: string;
    sources: string[];
  };

  role: {
    title: string;
    seniority: string;
    responsibilities: string[];
    requirements: Requirement[];
  };

  questions: Question[];

  flashcards: Flashcard[];

  schedule: {
    days_available: number;
    days: ScheduleDay[];
  };

  coverage: {
    uncovered_requirement_ids: string[];
    passes: number;
  };
};

type PracticeConfidence = "low" | "medium" | "high";

type PracticeResponse = {
  flashcardId: string;
  answer: string;
  confidence: PracticeConfidence;
  updatedAt: string;
};

type Kit = {
  _id: string;
  name: string;
  jobDescription: string;
  companyUrl: string;
  daysAvailable: number;
  status: "draft" | "generating" | "ready" | "failed";
  data?: GeneratedKit | null;
  createdAt: string;
  updatedAt: string;
  builderState?: {
    questionOrder?: string[];
  };
};

export default function KitDetailPage() {
  const router = useRouter();
  const params = useParams();

  const kitId = params.id as string;

  const [kit, setKit] = useState<Kit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");

  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
    null
  );

  const [editedPrompt, setEditedPrompt] = useState("");
  const [editedAnswerOutline, setEditedAnswerOutline] = useState("");

  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [isDeletingQuestionId, setIsDeletingQuestionId] = useState<string | null>(
    null
  );
  const [deleteQuestionError, setDeleteQuestionError] = useState("");
  const [deleteQuestionSuccess, setDeleteQuestionSuccess] = useState("");
  const [questionOrder, setQuestionOrder] = useState<string[] | null>(null);
  const [isReorderingQuestions, setIsReorderingQuestions] = useState(false);
  const [questionOrderError, setQuestionOrderError] = useState("");
  const [questionOrderSuccess, setQuestionOrderSuccess] = useState("");
  const [draggedQuestionId, setDraggedQuestionId] = useState<string | null>(null);
  const [dragOverQuestionId, setDragOverQuestionId] = useState<string | null>(null);
  const [isSavingCategoryId, setIsSavingCategoryId] = useState<string | null>(null);
  const [categorySaveError, setCategorySaveError] = useState("");
  const [categorySaveSuccess, setCategorySaveSuccess] = useState("");

  const [editingFlashcardId, setEditingFlashcardId] = useState<string | null>(
    null
  );
  const [editedFront, setEditedFront] = useState("");
  const [editedBack, setEditedBack] = useState("");
  const [isSavingFlashcard, setIsSavingFlashcard] = useState(false);
  const [flashcardSaveError, setFlashcardSaveError] = useState("");
  const [flashcardSaveSuccess, setFlashcardSaveSuccess] = useState("");

  const [isEditingCompanyBrief, setIsEditingCompanyBrief] = useState(false);
  const [editedCompanySummary, setEditedCompanySummary] = useState("");
  const [editedWhatTheyDo, setEditedWhatTheyDo] = useState("");
  const [isSavingCompanyBrief, setIsSavingCompanyBrief] = useState(false);
  const [companyBriefSaveError, setCompanyBriefSaveError] = useState("");
  const [companyBriefSaveSuccess, setCompanyBriefSaveSuccess] = useState("");
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceQueue, setPracticeQueue] = useState<string[]>([]);
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const [practiceConfidence, setPracticeConfidence] =
    useState<PracticeConfidence | null>(null);
  const [showPracticeOutline, setShowPracticeOutline] = useState(false);
  const [practiceResponses, setPracticeResponses] = useState<
    Record<string, PracticeResponse>
  >({});
  const [isLoadingPractice, setIsLoadingPractice] = useState(false);
  const [isSavingPractice, setIsSavingPractice] = useState(false);
  const [practiceSaveError, setPracticeSaveError] = useState("");
  const [practiceSaveSuccess, setPracticeSaveSuccess] = useState("");

  function getPracticeFlashcards() {
    return kit?.data?.flashcards ?? [];
  }

  function getPracticeCardOrder() {
    const flashcards = getPracticeFlashcards();
    const confidenceRank: Record<PracticeConfidence | "unanswered", number> = {
      unanswered: 0,
      low: 1,
      medium: 2,
      high: 3,
    };

    return [...flashcards].sort((a, b) => {
      const aConfidence = practiceResponses[a.id]?.confidence ?? "unanswered";
      const bConfidence = practiceResponses[b.id]?.confidence ?? "unanswered";
      return confidenceRank[aConfidence] - confidenceRank[bConfidence];
    });
  }

  function getPracticeCardsFromQueue() {
    const cardsById = new Map(getPracticeFlashcards().map((card) => [card.id, card]));
    return practiceQueue
      .map((id) => cardsById.get(id))
      .filter((card): card is NonNullable<typeof card> => Boolean(card));
  }

  function loadPracticeCard(index: number, cards = getPracticeCardsFromQueue()) {
    const card = cards[index];
    if (!card) return;

    const saved = practiceResponses[card.id];
    setPracticeAnswer(saved?.answer ?? "");
    setPracticeConfidence(saved?.confidence ?? null);
    setShowPracticeOutline(false);
    setPracticeSaveError("");
    setPracticeSaveSuccess("");
  }

  function startPracticeMode(startCardId?: string, freshAttempt = false) {
    const orderedCards = getPracticeCardOrder();
    if (!orderedCards.length) return;

    const orderedIds = orderedCards.map((card) => card.id);
    const requestedIndex = startCardId ? Math.max(0, orderedIds.indexOf(startCardId)) : 0;
    const nextIndex = startCardId && orderedIds.includes(startCardId) ? requestedIndex : 0;
    const nextCard = orderedCards[nextIndex];

    setPracticeQueue(orderedIds);
    setPracticeIndex(nextIndex);
    setIsPracticeMode(true);
    setPracticeSaveError("");
    setPracticeSaveSuccess("");
    setShowPracticeOutline(false);

    if (freshAttempt) {
      setPracticeAnswer("");
      setPracticeConfidence(null);
    } else {
      setPracticeAnswer(practiceResponses[nextCard.id]?.answer ?? "");
      setPracticeConfidence(practiceResponses[nextCard.id]?.confidence ?? null);
    }
  }

  function retryPracticeCard(cardId: string) {
    startPracticeMode(cardId, true);
  }

  function exitPracticeMode() {
    setIsPracticeMode(false);
    setPracticeIndex(0);
    setPracticeQueue([]);
    setPracticeAnswer("");
    setPracticeConfidence(null);
    setShowPracticeOutline(false);
    setPracticeSaveError("");
    setPracticeSaveSuccess("");
  }

  async function savePracticeResponse(goToNext = false) {
    if (!kit) return;

    const cards = getPracticeCardsFromQueue();
    const currentCard = cards[practiceIndex];
    if (!currentCard) return;

    if (!practiceAnswer.trim()) {
      setPracticeSaveError("Write an answer before saving this card.");
      return;
    }

    if (!practiceConfidence) {
      setPracticeSaveError("Choose a confidence level before saving this card.");
      return;
    }

    setIsSavingPractice(true);
    setPracticeSaveError("");
    setPracticeSaveSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/kits/${kit._id}/practice/${currentCard.id}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answer: practiceAnswer.trim(),
            confidence: practiceConfidence,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }
        setPracticeSaveError(
          result.error?.message ?? "Unable to save this practice response."
        );
        return;
      }

      const savedResponse = result.response as PracticeResponse;
      const updatedResponses = {
        ...practiceResponses,
        [currentCard.id]: savedResponse,
      };
      setPracticeResponses(updatedResponses);
      setPracticeSaveSuccess("Saved.");

      if (goToNext) {
        const nextIndex = practiceIndex + 1;
        if (nextIndex >= cards.length) {
          setIsPracticeMode(false);
          setPracticeIndex(0);
          setPracticeQueue([]);
          setPracticeAnswer("");
          setPracticeConfidence(null);
          setShowPracticeOutline(false);
        } else {
          setPracticeIndex(nextIndex);
          const nextCard = cards[nextIndex];
          const nextSaved = updatedResponses[nextCard.id];
          setPracticeAnswer(nextSaved?.answer ?? "");
          setPracticeConfidence(nextSaved?.confidence ?? null);
          setShowPracticeOutline(false);
          setPracticeSaveError("");
          setPracticeSaveSuccess("");
        }
      }
    } catch {
      setPracticeSaveError("Unable to connect to the server.");
    } finally {
      setIsSavingPractice(false);
    }
  }

  function movePracticeQuestion(direction: "next" | "previous") {
    const cards = getPracticeCardsFromQueue();
    if (!cards.length) return;

    const nextIndex =
      direction === "next"
        ? Math.min(practiceIndex + 1, cards.length - 1)
        : Math.max(practiceIndex - 1, 0);

    if (nextIndex === practiceIndex) return;
    setPracticeIndex(nextIndex);
    loadPracticeCard(nextIndex, cards);
  }

  function getWeakSpotReport() {
    if (!kit?.data) return [];

    const requirements = kit.data.role.requirements;
    const flashcards = kit.data.flashcards;

    return requirements
      .map((requirement) => {
        const linkedCards = flashcards.filter((card) =>
          card.requirement_ids.includes(requirement.id)
        );
        const responses = linkedCards
          .map((card) => practiceResponses[card.id])
          .filter((response): response is PracticeResponse => Boolean(response));
        const confidenceScore = responses.length
          ? responses.reduce(
            (total, response) =>
              total +
              (response.confidence === "high"
                ? 3
                : response.confidence === "medium"
                  ? 2
                  : 1),
            0
          ) / responses.length
          : 0;

        let status = "Not practiced";
        if (linkedCards.length === 0) {
          status = "No flashcard";
        } else if (responses.some((response) => response.confidence === "low")) {
          status = "Needs work";
        } else if (responses.length === linkedCards.length && confidenceScore >= 2.5) {
          status = "Strong";
        } else if (responses.length > 0) {
          status = "In progress";
        }

        return {
          ...requirement,
          cardCount: linkedCards.length,
          practicedCount: responses.length,
          confidenceScore,
          status,
        };
      })
      .sort((a, b) => {
        const priorityRank = (priority: Requirement["priority"]) =>
          priority === "must" ? 0 : 1;
        const statusRank = (status: string) =>
          ({ "No flashcard": 0, "Not practiced": 1, "Needs work": 2, "In progress": 3, Strong: 4 })[
          status
          ] ?? 5;
        return (
          priorityRank(a.priority) - priorityRank(b.priority) ||
          statusRank(a.status) - statusRank(b.status) ||
          a.confidenceScore - b.confidenceScore
        );
      });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadKit() {
      try {
        setIsLoading(true);
        setError("");

        const response = await fetch(`${API_URL}/kits/${kitId}`, {
          credentials: "include",
        });

        const result = await response.json();

        if (!response.ok) {
          if (response.status === 401) {
            router.push("/login");
            return;
          }

          if (!cancelled) {
            setError(result.error?.message ?? "Unable to load this kit.");
          }

          return;
        }

        if (!cancelled) {
          setKit(result.kit);
          setQuestionOrder(
            Array.isArray(result.kit?.builderState?.questionOrder)
              ? result.kit.builderState.questionOrder
              : null
          );
          setQuestionOrderError("");
          setError("");
        }
      } catch {
        if (!cancelled) {
          setError("Unable to connect to the server.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadKit();

    return () => {
      cancelled = true;
    };
  }, [kitId, router]);

  useEffect(() => {
    if (kit?.status !== "ready") return;

    let cancelled = false;

    async function loadPracticeResponses() {
      setIsLoadingPractice(true);
      try {
        const response = await fetch(`${API_URL}/kits/${kitId}/practice`, {
          credentials: "include",
        });
        const result = await response.json();

        if (!response.ok) {
          if (response.status === 401) {
            router.push("/login");
            return;
          }
          if (!cancelled) {
            setPracticeSaveError(
              result.error?.message ?? "Unable to load practice history."
            );
          }
          return;
        }

        if (!cancelled) {
          setPracticeResponses(result.responses ?? {});
          setPracticeSaveError("");
        }
      } catch {
        if (!cancelled) {
          setPracticeSaveError("Unable to load saved practice history.");
        }
      } finally {
        if (!cancelled) setIsLoadingPractice(false);
      }
    }

    void loadPracticeResponses();

    return () => {
      cancelled = true;
    };
  }, [kit?.status, kitId, router]);

  async function generateKit() {
    setIsGenerating(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/kits/${kitId}/generate`, {
        method: "POST",
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/login");
          return;
        }

        setError(
          result.error?.message ?? "Unable to generate the interview kit."
        );

        return;
      }

      setKit((currentKit) =>
        currentKit
          ? {
            ...currentKit,
            status: "ready",
            data: result.data,
          }
          : currentKit
      );
      setPracticeResponses({});
      setIsPracticeMode(false);
      setPracticeIndex(0);
      setPracticeQueue([]);
      setPracticeAnswer("");
      setPracticeConfidence(null);
      setShowPracticeOutline(false);
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setIsGenerating(false);
    }
  }

  function startEditingQuestion(question: Question) {
    setEditingQuestionId(question.id);
    setEditedPrompt(question.prompt);
    setEditedAnswerOutline(question.answer_outline);
    setSaveError("");
    setSaveSuccess("");
  }

  function cancelEditingQuestion() {
    setEditingQuestionId(null);
    setEditedPrompt("");
    setEditedAnswerOutline("");
    setSaveError("");
    setSaveSuccess("");
  }

  async function saveQuestion(questionId: string) {
    if (!kit) {
      return;
    }

    if (!editedPrompt.trim() || !editedAnswerOutline.trim()) {
      setSaveError("Question and answer outline cannot be empty.");
      return;
    }

    setIsSavingQuestion(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const response = await fetch(`${API_URL}/kits/${kit._id}/builder`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionId,
          prompt: editedPrompt.trim(),
          answer_outline: editedAnswerOutline.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setSaveError(
          result.error?.message ?? "Unable to save question."
        );

        return;
      }

      setKit((currentKit) => {
        if (!currentKit) {
          return currentKit;
        }

        const currentData = currentKit.data;

        if (!currentData?.questions) {
          return currentKit;
        }

        return {
          ...currentKit,
          data: {
            ...currentData,
            questions: currentData.questions.map((question) =>
              question.id === questionId
                ? {
                  ...question,
                  prompt: editedPrompt.trim(),
                  answer_outline: editedAnswerOutline.trim(),
                }
                : question
            ),
          },
        };
      });

      cancelEditingQuestion();
      setSaveSuccess("Question saved.");
    } catch {
      setSaveError("Unable to connect to the server.");
    } finally {
      setIsSavingQuestion(false);
    }
  }

  async function saveQuestionCategory(
    questionId: string,
    category: Question["category"]
  ) {
    if (!kit) {
      return;
    }

    setIsSavingCategoryId(questionId);
    setCategorySaveError("");
    setCategorySaveSuccess("");

    try {
      const response = await fetch(`${API_URL}/kits/${kit._id}/builder`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionId,
          category,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setCategorySaveError(
          result.error?.message ?? "Unable to save question category."
        );
        return;
      }

      if (result.kit?.data) {
        setKit((currentKit) =>
          currentKit
            ? {
              ...currentKit,
              data: result.kit.data,
              builderState: result.kit.builderState ?? currentKit.builderState,
            }
            : currentKit
        );
        setCategorySaveSuccess("Category updated.");
      }
    } catch {
      setCategorySaveError("Unable to connect to the server.");
    } finally {
      setIsSavingCategoryId(null);
    }
  }

  function getOrderedQuestions(questions: Question[]) {
    if (!questionOrder || questionOrder.length === 0) {
      return questions;
    }

    const questionMap = new Map(
      questions.map((question) => [question.id, question])
    );

    const ordered = questionOrder
      .map((questionId) => questionMap.get(questionId))
      .filter((question): question is Question => Boolean(question));

    const orderedIds = new Set(ordered.map((question) => question.id));

    return [
      ...ordered,
      ...questions.filter((question) => !orderedIds.has(question.id)),
    ];
  }

  async function saveQuestionOrder(nextOrder: string[]) {
    if (!kit?.data?.questions || isReorderingQuestions) {
      return;
    }

    const previousOrder = getOrderedQuestions(kit.data.questions).map(
      (question) => question.id
    );

    if (
      nextOrder.length !== previousOrder.length ||
      nextOrder.every((questionId, index) => questionId === previousOrder[index])
    ) {
      return;
    }

    setIsReorderingQuestions(true);
    setQuestionOrderError("");
    setQuestionOrderSuccess("");
    setQuestionOrder(nextOrder);

    try {
      const response = await fetch(`${API_URL}/kits/${kit._id}/builder`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionOrder: nextOrder,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setQuestionOrder(previousOrder);
        setQuestionOrderError(
          result.error?.message ?? "Unable to reorder questions."
        );
        return;
      }

      if (Array.isArray(result.kit?.builderState?.questionOrder)) {
        setQuestionOrder(result.kit.builderState.questionOrder);
      }
      setQuestionOrderSuccess("Question order saved.");
    } catch {
      setQuestionOrder(previousOrder);
      setQuestionOrderError("Unable to connect to the server.");
    } finally {
      setIsReorderingQuestions(false);
    }
  }

  function handleQuestionDragStart(
    event: DragEvent<HTMLElement>,
    questionId: string
  ) {
    if (isReorderingQuestions || editingQuestionId) {
      event.preventDefault();
      return;
    }

    setDraggedQuestionId(questionId);
    setDragOverQuestionId(questionId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", questionId);
  }

  function handleQuestionDragOver(
    event: DragEvent<HTMLElement>,
    questionId: string
  ) {
    if (
      !draggedQuestionId ||
      draggedQuestionId === questionId ||
      isReorderingQuestions ||
      editingQuestionId
    ) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverQuestionId(questionId);
  }

  async function handleQuestionDrop(
    event: DragEvent<HTMLElement>,
    questionId: string
  ) {
    event.preventDefault();

    const sourceQuestionId =
      draggedQuestionId ?? event.dataTransfer.getData("text/plain");

    if (
      !kit?.data?.questions ||
      !sourceQuestionId ||
      sourceQuestionId === questionId ||
      isReorderingQuestions ||
      editingQuestionId
    ) {
      setDraggedQuestionId(null);
      setDragOverQuestionId(null);
      return;
    }

    const currentQuestions = getOrderedQuestions(kit.data.questions);
    const sourceIndex = currentQuestions.findIndex(
      (question) => question.id === sourceQuestionId
    );
    const targetIndex = currentQuestions.findIndex(
      (question) => question.id === questionId
    );

    if (sourceIndex === -1 || targetIndex === -1) {
      setDraggedQuestionId(null);
      setDragOverQuestionId(null);
      return;
    }

    const nextQuestions = [...currentQuestions];
    const [movedQuestion] = nextQuestions.splice(sourceIndex, 1);
    nextQuestions.splice(targetIndex, 0, movedQuestion);

    setDraggedQuestionId(null);
    setDragOverQuestionId(null);

    await saveQuestionOrder(
      nextQuestions.map((question) => question.id)
    );
  }

  function handleQuestionDragEnd() {
    setDraggedQuestionId(null);
    setDragOverQuestionId(null);
  }

  async function moveQuestionWithKeyboard(
    questionId: string,
    direction: "up" | "down"
  ) {
    if (
      !kit?.data?.questions ||
      isReorderingQuestions ||
      editingQuestionId
    ) {
      return;
    }

    const currentQuestions = getOrderedQuestions(kit.data.questions);
    const currentIndex = currentQuestions.findIndex(
      (question) => question.id === questionId
    );

    if (currentIndex === -1) {
      return;
    }

    const targetIndex =
      direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex < 0 || targetIndex >= currentQuestions.length) {
      return;
    }

    const nextQuestions = [...currentQuestions];
    const [movedQuestion] = nextQuestions.splice(currentIndex, 1);
    nextQuestions.splice(targetIndex, 0, movedQuestion);

    await saveQuestionOrder(
      nextQuestions.map((question) => question.id)
    );
  }

  function handleQuestionKeyDown(
    event: KeyboardEvent<HTMLElement>,
    questionId: string
  ) {
    if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) {
      return;
    }

    event.preventDefault();

    void moveQuestionWithKeyboard(
      questionId,
      event.key === "ArrowUp" ? "up" : "down"
    );
  }

  async function deleteQuestion(questionId: string) {
    if (!kit) {
      return;
    }

    const question = kit.data?.questions.find(
      (currentQuestion) => currentQuestion.id === questionId
    );

    if (!question) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this question? It will also be removed from the preparation schedule."
    );

    if (!confirmed) {
      return;
    }

    setIsDeletingQuestionId(questionId);
    setDeleteQuestionError("");
    setDeleteQuestionSuccess("");

    try {
      const response = await fetch(`${API_URL}/kits/${kit._id}/builder`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deleteQuestionId: questionId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setDeleteQuestionError(
          result.error?.message ?? "Unable to delete question."
        );
        return;
      }

      setKit((currentKit) => {
        if (!currentKit || !result.kit?.data) {
          return currentKit;
        }

        return {
          ...currentKit,
          data: result.kit.data,
          builderState: result.kit.builderState ?? currentKit.builderState,
        };
      });

      if (Array.isArray(result.kit?.builderState?.questionOrder)) {
        setQuestionOrder(result.kit.builderState.questionOrder);
      }

      if (editingQuestionId === questionId) {
        cancelEditingQuestion();
      }
      setDeleteQuestionSuccess("Question deleted.");
    } catch {
      setDeleteQuestionError("Unable to connect to the server.");
    } finally {
      setIsDeletingQuestionId(null);
    }
  }

  function startEditingFlashcard(flashcard: Flashcard) {
    setEditingFlashcardId(flashcard.id);
    setEditedFront(flashcard.front);
    setEditedBack(flashcard.back);
    setFlashcardSaveError("");
    setFlashcardSaveSuccess("");
  }

  function cancelEditingFlashcard() {
    setEditingFlashcardId(null);
    setEditedFront("");
    setEditedBack("");
    setFlashcardSaveError("");
    setFlashcardSaveSuccess("");
  }

  async function saveFlashcard(flashcardId: string) {
    if (!kit) {
      return;
    }

    if (!editedFront.trim() || !editedBack.trim()) {
      setFlashcardSaveError("Question and answer cannot be empty.");
      return;
    }

    setIsSavingFlashcard(true);
    setFlashcardSaveError("");
    setFlashcardSaveSuccess("");

    try {
      const response = await fetch(`${API_URL}/kits/${kit._id}/builder`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          flashcardId,
          front: editedFront.trim(),
          back: editedBack.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setFlashcardSaveError(
          result.error?.message ?? "Unable to save flashcard."
        );
        return;
      }

      setKit((currentKit) => {
        if (!currentKit) {
          return currentKit;
        }

        const currentData = currentKit.data;

        if (!currentData?.flashcards) {
          return currentKit;
        }

        return {
          ...currentKit,
          data: {
            ...currentData,
            flashcards: currentData.flashcards.map((flashcard) =>
              flashcard.id === flashcardId
                ? {
                  ...flashcard,
                  front: editedFront.trim(),
                  back: editedBack.trim(),
                }
                : flashcard
            ),
          },
        };
      });

      cancelEditingFlashcard();
      setFlashcardSaveSuccess("Flashcard saved.");
    } catch {
      setFlashcardSaveError("Unable to connect to the server.");
    } finally {
      setIsSavingFlashcard(false);
    }
  }

  function startEditingCompanyBrief() {
    if (!kit?.data?.company_brief) {
      return;
    }

    setEditedCompanySummary(kit.data.company_brief.summary);
    setEditedWhatTheyDo(kit.data.company_brief.what_they_do);
    setCompanyBriefSaveError("");
    setCompanyBriefSaveSuccess("");
    setIsEditingCompanyBrief(true);
  }

  function cancelEditingCompanyBrief() {
    setIsEditingCompanyBrief(false);
    setEditedCompanySummary("");
    setEditedWhatTheyDo("");
    setCompanyBriefSaveError("");
    setCompanyBriefSaveSuccess("");
  }

  async function saveCompanyBrief() {
    if (!kit) {
      return;
    }

    if (!editedCompanySummary.trim() || !editedWhatTheyDo.trim()) {
      setCompanyBriefSaveError(
        "Summary and what they do cannot be empty."
      );
      return;
    }

    setIsSavingCompanyBrief(true);
    setCompanyBriefSaveError("");
    setCompanyBriefSaveSuccess("");

    try {
      const response = await fetch(`${API_URL}/kits/${kit._id}/builder`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          companyBrief: {
            summary: editedCompanySummary.trim(),
            what_they_do: editedWhatTheyDo.trim(),
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setCompanyBriefSaveError(
          result.error?.message ?? "Unable to save company brief."
        );
        return;
      }

      setKit((currentKit) => {
        if (!currentKit) {
          return currentKit;
        }

        const currentData = currentKit.data;

        if (!currentData?.company_brief) {
          return currentKit;
        }

        return {
          ...currentKit,
          data: {
            ...currentData,
            company_brief: {
              ...currentData.company_brief,
              summary: editedCompanySummary.trim(),
              what_they_do: editedWhatTheyDo.trim(),
            },
          },
        };
      });

      cancelEditingCompanyBrief();
      setCompanyBriefSaveSuccess("Company brief saved.");
    } catch {
      setCompanyBriefSaveError("Unable to connect to the server.");
    } finally {
      setIsSavingCompanyBrief(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-950 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 h-4 w-32 animate-pulse rounded bg-zinc-200" />

          <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="h-8 w-2/3 animate-pulse rounded bg-zinc-200" />
            <div className="mt-3 h-4 w-1/2 animate-pulse rounded bg-zinc-100" />

            <div className="mt-8 space-y-3">
              <div className="h-4 w-full animate-pulse rounded bg-zinc-100" />
              <div className="h-4 w-11/12 animate-pulse rounded bg-zinc-100" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-zinc-100" />
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="h-48 animate-pulse rounded-2xl border border-zinc-200 bg-white shadow-sm lg:col-span-2" />
            <div className="h-48 animate-pulse rounded-2xl border border-zinc-200 bg-white shadow-sm" />
          </div>
        </div>
      </main>
    );
  }

  if (error && !kit) {
    return (
      <main className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-950 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-5xl">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mb-6 rounded-lg px-2 py-1 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2"
          >
            ← Back to dashboard
          </button>

          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-6"
          >
            <h1 className="text-lg font-semibold text-red-900">
              Unable to load this interview kit
            </h1>

            <p className="mt-2 text-sm leading-6 text-red-700">
              {error}
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2"
            >
              Try again
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!kit) {
    return null;
  }

  const data = kit.data;

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-950 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mb-6 rounded-lg px-2 py-1 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2"
        >
          ← Back to dashboard
        </button>

        <header className="mb-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div>
              <p className="mb-2 text-sm font-medium text-zinc-500">
                Interview Kit
              </p>

              <h1 className="text-3xl font-semibold tracking-tight">
                {kit.name}
              </h1>

              <a
                href={kit.companyUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-950"
              >
                {kit.companyUrl}
              </a>
            </div>

            <div className="flex items-center gap-3">
              <span className="w-fit rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium capitalize text-zinc-600">
                {kit.status}
              </span>

              {(kit.status === "draft" ||
                kit.status === "failed" ||
                kit.status === "ready") && (
                  <button
                    type="button"
                    onClick={generateKit}
                    disabled={isGenerating}
                    className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isGenerating
                      ? "Generating..."
                      : kit.status === "ready"
                        ? "Regenerate"
                        : kit.status === "failed"
                          ? "Retry generation"
                          : "Generate preparation kit"}
                  </button>
                )}
            </div>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="lg:col-span-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">Job description</h2>

              <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-zinc-600">
                {kit.jobDescription}
              </div>
            </div>
          </section>

          <aside>
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold">
                Preparation details
              </h2>

              <div className="mt-5 space-y-4 text-sm">
                <div>
                  <p className="text-zinc-500">Days available</p>
                  <p className="mt-1 font-medium">
                    {kit.daysAvailable}{" "}
                    {kit.daysAvailable === 1 ? "day" : "days"}
                  </p>
                </div>

                <div>
                  <p className="text-zinc-500">Status</p>
                  <p className="mt-1 font-medium capitalize">
                    {kit.status}
                  </p>
                </div>

                <div>
                  <p className="text-zinc-500">Created</p>
                  <p className="mt-1 font-medium">
                    {new Date(kit.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {kit.status === "generating" && (
          <section className="mt-6" aria-live="polite">
            <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
              <div
                className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-950"
                aria-hidden="true"
              />

              <h2 className="mt-4 text-lg font-semibold">
                Building your preparation kit
              </h2>

              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-500">
                This can take a little while. We&apos;re extracting requirements,
                researching the company, generating interview questions and
                flashcards, checking requirement coverage, and building your
                preparation schedule.
              </p>

              <p className="mt-4 text-xs text-zinc-400">
                You can leave this page open while generation runs.
              </p>
            </div>
          </section>
        )}

        {kit.status === "failed" && (
          <section className="mt-6">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
              <h2 className="text-lg font-semibold text-red-900">
                Generation failed
              </h2>

              <p className="mt-2 text-sm leading-6 text-red-700">
                Something went wrong while building this preparation kit.
                You can retry the generation without recreating the kit.
              </p>
            </div>
          </section>
        )}

        {kit.status === "draft" && (
          <section className="mt-6">
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center">
              <h2 className="text-lg font-semibold">
                Your preparation kit is ready to generate
              </h2>

              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-zinc-500">
                Generate a personalized kit containing company research,
                requirements, interview questions, a preparation schedule,
                and flashcards.
              </p>

              <button
                type="button"
                onClick={generateKit}
                disabled={isGenerating}
                className="mt-5 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating
                  ? "Generating..."
                  : "Generate preparation kit"}
              </button>
            </div>
          </section>
        )}

        {kit.status === "ready" && data && (
          <div className="mt-6 space-y-6">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm outline-none transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2">
                <span className="text-base font-semibold text-zinc-950">
                  Company brief
                </span>
                <span
                  className="shrink-0 text-sm text-zinc-500 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                >
                  ▾
                </span>
              </summary>

              <div className="mt-3">
                <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <h2 className="text-xl font-semibold">Company brief</h2>
                      <p className="mt-1 text-sm text-zinc-500">
                        Edit the research summary while keeping the original sources.
                      </p>
                    </div>

                    {!isEditingCompanyBrief && (
                      <button
                        type="button"
                        onClick={startEditingCompanyBrief}
                        className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  <div className="mt-5 space-y-5">
                    {isEditingCompanyBrief ? (
                      <div>
                        <label className="block">
                          <span className="text-sm font-medium text-zinc-700">
                            Summary
                          </span>

                          <textarea
                            value={editedCompanySummary}
                            onChange={(event) =>
                              setEditedCompanySummary(event.target.value)
                            }
                            rows={5}
                            className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950"
                          />
                        </label>

                        <label className="mt-4 block">
                          <span className="text-sm font-medium text-zinc-700">
                            What they do
                          </span>

                          <textarea
                            value={editedWhatTheyDo}
                            onChange={(event) =>
                              setEditedWhatTheyDo(event.target.value)
                            }
                            rows={5}
                            className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950"
                          />
                        </label>

                        {companyBriefSaveError && (
                          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                            {companyBriefSaveError}
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={saveCompanyBrief}
                            disabled={isSavingCompanyBrief}
                            className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isSavingCompanyBrief ? "Saving..." : "Save changes"}
                          </button>

                          <button
                            type="button"
                            onClick={cancelEditingCompanyBrief}
                            disabled={isSavingCompanyBrief}
                            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <p className="text-sm font-medium text-zinc-500">
                            Summary
                          </p>

                          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-zinc-700">
                            {data.company_brief.summary}
                          </p>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-zinc-500">
                            What they do
                          </p>

                          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-zinc-700">
                            {data.company_brief.what_they_do}
                          </p>
                        </div>
                      </>
                    )}

                    {data.company_brief.sources.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-zinc-500">
                          Research sources
                        </p>

                        <div className="mt-2 space-y-1">
                          {data.company_brief.sources.map((source) => (
                            <a
                              key={source}
                              href={source}
                              target="_blank"
                              rel="noreferrer"
                              className="block text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-950"
                            >
                              {source}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </details>

            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm outline-none transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2">
                <span className="text-base font-semibold text-zinc-950">
                  Role & requirements
                </span>
                <span
                  className="shrink-0 text-sm text-zinc-500 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                >
                  ▾
                </span>
              </summary>

              <div className="mt-3">
                <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div>
                      <h2 className="text-xl font-semibold">
                        Role & requirements
                      </h2>

                      <p className="mt-1 text-sm text-zinc-500">
                        {data.role.title} · {data.role.seniority}
                      </p>
                    </div>

                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                      {data.role.requirements.length} requirements
                    </span>
                  </div>

                  <div className="mt-6">
                    <h3 className="text-sm font-semibold">
                      Responsibilities
                    </h3>

                    {data.role.responsibilities.length > 0 ? (
                      <ul className="mt-3 space-y-2">
                        {data.role.responsibilities.map(
                          (responsibility, index) => (
                            <li
                              key={`${responsibility}-${index}`}
                              className="text-sm leading-6 text-zinc-700"
                            >
                              • {responsibility}
                            </li>
                          )
                        )}
                      </ul>
                    ) : (
                      <div className="mt-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm leading-6 text-zinc-500">
                        No responsibilities were identified from this job
                        description.
                      </div>
                    )}
                  </div>

                  <div className="mt-7">
                    <h3 className="text-sm font-semibold">
                      Requirements
                    </h3>

                    {data.role.requirements.length > 0 ? (
                      <div className="mt-3 space-y-3">
                        {data.role.requirements.map((requirement) => (
                          <div
                            key={requirement.id}
                            className="rounded-xl border border-zinc-200 p-4"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <p className="text-sm leading-6 text-zinc-800">
                                {requirement.text}
                              </p>

                              <div className="flex shrink-0 gap-2">
                                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium capitalize text-zinc-600">
                                  {requirement.kind}
                                </span>

                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${requirement.priority === "must"
                                    ? "bg-zinc-950 text-white"
                                    : "bg-zinc-100 text-zinc-600"
                                    }`}
                                >
                                  {requirement.priority}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm leading-6 text-zinc-500">
                        No explicit requirements were identified. The job
                        description may be too thin to extract reliable
                        requirements.
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </details>

            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm outline-none transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2">
                <span className="text-base font-semibold text-zinc-950">
                  Preparation schedule
                </span>
                <span
                  className="shrink-0 text-sm text-zinc-500 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                >
                  ▾
                </span>
              </summary>

              <div className="mt-3">
                <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div>
                      <h2 className="text-xl font-semibold">
                        Preparation schedule
                      </h2>

                      <p className="mt-1 text-sm text-zinc-500">
                        A {data.schedule.days_available}-day preparation plan.
                      </p>
                    </div>

                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                      {data.schedule.days.reduce(
                        (total, day) => total + day.minutes,
                        0
                      )}{" "}
                      minutes
                    </span>
                  </div>

                  {data.schedule.days.length > 0 ? (
                    <div className="mt-6 space-y-3">
                      {data.schedule.days.map((day) => {
                        const scheduledQuestions = day.question_ids
                          .map((questionId) =>
                            data.questions.find((question) => question.id === questionId)
                          )
                          .filter((question): question is Question => Boolean(question));

                        const missingQuestionCount =
                          day.question_ids.length - scheduledQuestions.length;

                        return (
                          <details
                            key={day.day}
                            className="group rounded-xl border border-zinc-200 p-5"
                          >
                            <summary className="cursor-pointer list-none outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 rounded-lg">
                              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                      Day {day.day}
                                    </span>

                                    <span className="text-zinc-300" aria-hidden="true">
                                      ·
                                    </span>

                                    <span className="text-xs text-zinc-500">
                                      {day.question_ids.length}{" "}
                                      {day.question_ids.length === 1
                                        ? "question"
                                        : "questions"}
                                    </span>
                                  </div>

                                  <h3 className="mt-1 font-medium text-zinc-900">
                                    {day.focus}
                                  </h3>
                                </div>

                                <div className="flex w-fit items-center gap-2">
                                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                                    {day.minutes} min
                                  </span>

                                  <span
                                    className="text-zinc-400 transition-transform group-open:rotate-180"
                                    aria-hidden="true"
                                  >
                                    ▾
                                  </span>
                                </div>
                              </div>
                            </summary>

                            <div className="mt-4 border-t border-zinc-100 pt-4">
                              {scheduledQuestions.length > 0 ? (
                                <ol className="space-y-3">
                                  {scheduledQuestions.map((question, index) => (
                                    <li
                                      key={question.id}
                                      className="rounded-lg border border-zinc-100 bg-zinc-50 p-4"
                                    >
                                      <div className="flex gap-3">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-zinc-600 ring-1 ring-zinc-200">
                                          {index + 1}
                                        </span>

                                        <div className="min-w-0">
                                          <p className="text-sm font-medium leading-6 text-zinc-900">
                                            {question.prompt}
                                          </p>

                                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                                            <span className="rounded-full bg-white px-2 py-1 ring-1 ring-zinc-200">
                                              {question.category}
                                            </span>

                                            <span className="rounded-full bg-white px-2 py-1 ring-1 ring-zinc-200">
                                              Difficulty {question.difficulty}/3
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </li>
                                  ))}
                                </ol>
                              ) : (
                                <p className="text-sm text-zinc-500">
                                  No questions are currently assigned to this day.
                                </p>
                              )}

                              {missingQuestionCount > 0 && (
                                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                                  {missingQuestionCount} scheduled{" "}
                                  {missingQuestionCount === 1
                                    ? "question"
                                    : "questions"}{" "}
                                  could not be found in the current question bank.
                                  This can happen after a question was deleted or
                                  regenerated.
                                </p>
                              )}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center text-sm leading-6 text-zinc-500">
                      No preparation schedule is available for this kit.
                    </div>
                  )}
                </section>
              </div>
            </details>

            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm outline-none transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2">
                <span className="text-base font-semibold text-zinc-950">
                  Practice mode
                </span>
                <span
                  className="shrink-0 text-sm text-zinc-500 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                >
                  ▾
                </span>
              </summary>

              <div className="mt-3">
                <section
                  className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
                  aria-labelledby="practice-mode-heading"
                >
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                      <h2 id="practice-mode-heading" className="text-xl font-semibold">
                        Practice mode
                      </h2>
                      <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
                        Work through flashcards one at a time. Write your own answer,
                        reveal the reference answer, then record how confident you felt.
                        Your progress is saved to this kit.
                      </p>
                    </div>

                    {!isPracticeMode && (
                      <button
                        type="button"
                        onClick={() => startPracticeMode}
                        disabled={data.flashcards.length === 0 || isLoadingPractice}
                        className="shrink-0 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isLoadingPractice ? "Loading history..." : "Start practice"}
                      </button>
                    )}
                  </div>

                  {practiceSaveError && (
                    <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                      {practiceSaveError}
                    </div>
                  )}

                  {data.flashcards.length === 0 ? (
                    <div className="mt-5 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-500">
                      Generate flashcards before starting practice mode.
                    </div>
                  ) : !isPracticeMode ? (
                    <div className="mt-5 space-y-5">
                      <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-5 text-sm text-zinc-600">
                        <div className="flex flex-wrap gap-x-5 gap-y-2">
                          <span><strong className="text-zinc-900">{Object.keys(practiceResponses).length}</strong> of {data.flashcards.length} cards practiced</span>
                          <span><strong className="text-zinc-900">{Object.values(practiceResponses).filter((response) => response.confidence === "low").length}</strong> low-confidence cards</span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-zinc-500">
                          New sessions automatically start with unanswered and least-confident cards. Use “Retry this card” to make a fresh attempt on a saved card. A requirement with no linked flashcard is shown as “No flashcard”, not as an uncovered requirement.
                        </p>
                      </div>

                      <div>
                        <h3 className="text-base font-semibold">Weak spots</h3>
                        <p className="mt-1 text-sm text-zinc-500">
                          A deterministic report based on your saved confidence ratings.
                        </p>
                        {getWeakSpotReport().length > 0 ? (
                          <div className="mt-4 space-y-3">
                            {getWeakSpotReport().map((item) => (
                              <div key={item.id} className="rounded-xl border border-zinc-200 p-4">
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <p className="text-sm font-medium leading-6 text-zinc-900">{item.text}</p>
                                    <p className="mt-1 text-xs text-zinc-500">{item.cardCount === 0 ? "No flashcard linked to this requirement" : `${item.practicedCount}/${item.cardCount} linked cards practiced`}</p>
                                  </div>
                                  <div className="flex gap-2">
                                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium capitalize text-zinc-600">{item.priority}</span>
                                    <span className="rounded-full bg-zinc-950 px-2.5 py-1 text-xs font-medium text-white">{item.status}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500">No requirements are available for a weak-spots report yet.</div>
                        )}
                      </div>

                      {Object.keys(practiceResponses).length > 0 && (
                        <div>
                          <h3 className="text-base font-semibold">Saved practice answers</h3>
                          <p className="mt-1 text-sm text-zinc-500">Your written attempts are stored with the kit so you can review them later.</p>
                          <div className="mt-4 space-y-3">
                            {data.flashcards.filter((card) => practiceResponses[card.id]).map((card) => {
                              const saved = practiceResponses[card.id];
                              return (
                                <details key={card.id} className="rounded-xl border border-zinc-200 p-4">
                                  <summary className="cursor-pointer text-sm font-medium text-zinc-900">
                                    {card.front}
                                    <span className="ml-2 rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium capitalize text-zinc-600">{saved.confidence} confidence</span>
                                  </summary>
                                  <div className="mt-3 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={(event) => {
                                        event.preventDefault();
                                        retryPracticeCard(card.id);
                                      }}
                                      className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-100"
                                    >
                                      Retry this card
                                    </button>
                                  </div>
                                  <div className="mt-4 space-y-3 text-sm leading-6">
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Your answer</p>
                                      <p className="mt-1 whitespace-pre-wrap text-zinc-700">{saved.answer || "No written answer was saved."}</p>
                                    </div>
                                    <div className="rounded-lg bg-zinc-50 p-3">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Reference answer</p>
                                      <p className="mt-1 whitespace-pre-wrap text-zinc-700">{card.back}</p>
                                    </div>
                                  </div>
                                </details>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    (() => {
                      const practiceCards = getPracticeCardsFromQueue();
                      const currentCard = practiceCards[practiceIndex];
                      if (!currentCard) return null;
                      const isLastCard = practiceIndex === practiceCards.length - 1;

                      return (
                        <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 sm:p-6">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-medium text-zinc-700">Card {practiceIndex + 1} of {practiceCards.length}</p>
                              <p className="mt-1 text-xs text-zinc-500">Unanswered and least-confident cards are prioritized.</p>
                            </div>
                            <span className="w-fit rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-600">{currentCard.requirement_ids.length} linked requirement{currentCard.requirement_ids.length === 1 ? "" : "s"}</span>
                          </div>

                          <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-5">
                            <p className="text-base font-medium leading-7 text-zinc-950">{currentCard.front}</p>
                            <label htmlFor="practice-answer" className="mt-5 block text-sm font-medium text-zinc-800">Your answer</label>
                            <textarea id="practice-answer" value={practiceAnswer} onChange={(event) => setPracticeAnswer(event.target.value)} rows={6} placeholder="Write your answer before revealing the reference answer..." className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-sm leading-6 text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950" />

                            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <button type="button" onClick={() => setShowPracticeOutline((current) => !current)} className="w-fit rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100">{showPracticeOutline ? "Hide reference answer" : "Reveal reference answer"}</button>
                              <span className="text-xs text-zinc-500">Compare your attempt with the reference answer, then rate your confidence. This is self-assessment, not an objective grader.</span>
                            </div>

                            {showPracticeOutline && (
                              <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4" aria-live="polite">
                                <h3 className="text-sm font-semibold text-zinc-950">Reference answer</h3>
                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{currentCard.back}</p>
                              </div>
                            )}

                            <fieldset className="mt-5">
                              <legend className="text-sm font-semibold text-zinc-800">How confident were you?</legend>
                              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                {(["low", "medium", "high"] as PracticeConfidence[]).map((confidence) => (
                                  <button key={confidence} type="button" aria-pressed={practiceConfidence === confidence} onClick={() => setPracticeConfidence(confidence)} className={`rounded-lg border px-3 py-2.5 text-sm font-medium capitalize transition ${practiceConfidence === confidence ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-100"}`}>{confidence}</button>
                                ))}
                              </div>
                            </fieldset>

                            {practiceSaveSuccess && <p className="mt-3 text-sm text-zinc-600" role="status" aria-live="polite">✓ {practiceSaveSuccess}</p>}
                          </div>

                          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <button type="button" onClick={exitPracticeMode} disabled={isSavingPractice} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50">Exit practice</button>
                            <div className="flex flex-wrap gap-3">
                              <button type="button" onClick={() => movePracticeQuestion("previous")} disabled={practiceIndex === 0 || isSavingPractice} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
                              <button type="button" onClick={() => void savePracticeResponse(false)} disabled={isSavingPractice || !practiceAnswer.trim() || !practiceConfidence} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50">{isSavingPractice ? "Saving..." : "Save"}</button>
                              <button type="button" onClick={() => void savePracticeResponse(true)} disabled={isSavingPractice || !practiceAnswer.trim() || !practiceConfidence} className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50">{isSavingPractice ? "Saving..." : isLastCard ? "Save & finish" : "Save & next"}</button>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </section>
              </div>
            </details>

            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm outline-none transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2">
                <span className="text-base font-semibold text-zinc-950">
                  Interview questions
                </span>
                <span
                  className="shrink-0 text-sm text-zinc-500 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                >
                  ▾
                </span>
              </summary>

              <div className="mt-3">
                <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div>
                      <h2 className="text-xl font-semibold">
                        Interview questions
                      </h2>

                      <p className="mt-1 text-sm text-zinc-500">
                        Questions generated from the extracted requirements. Drag cards
                        to reorder them, or focus a card and use Alt + Arrow Up/Down.
                      </p>
                    </div>

                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                      {data.questions.length} questions
                    </span>
                  </div>

                  {data.questions.length > 0 ? (
                    <div
                      className="mt-6 space-y-4"
                      role="list"
                      aria-label="Interview questions"
                    >
                      {getOrderedQuestions(data.questions).map((question, index) => {
                        const isEditing =
                          editingQuestionId === question.id;

                        return (
                          <article
                            key={question.id}
                            draggable={!editingQuestionId && !isReorderingQuestions}
                            tabIndex={editingQuestionId ? -1 : 0}
                            role="listitem"
                            aria-label={`Question ${index + 1}: ${question.prompt}`}
                            onKeyDown={(event) =>
                              handleQuestionKeyDown(event, question.id)
                            }
                            onDragStart={(event) =>
                              handleQuestionDragStart(event, question.id)
                            }
                            onDragOver={(event) =>
                              handleQuestionDragOver(event, question.id)
                            }
                            onDrop={(event) =>
                              void handleQuestionDrop(event, question.id)
                            }
                            onDragEnd={handleQuestionDragEnd}
                            className={`rounded-xl border p-5 transition focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 ${dragOverQuestionId === question.id &&
                              draggedQuestionId !== question.id
                              ? "border-zinc-950 bg-zinc-50 shadow-sm"
                              : "border-zinc-200"
                              } ${draggedQuestionId === question.id
                                ? "cursor-grabbing opacity-50"
                                : !editingQuestionId
                                  ? "cursor-grab"
                                  : ""
                              }`}
                          >
                            {isEditing ? (
                              <div>
                                <div className="mb-4 flex items-center justify-between gap-3">
                                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                    Question {index + 1}
                                  </span>

                                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium capitalize text-zinc-600">
                                    {question.category}
                                  </span>
                                </div>

                                <label className="block">
                                  <span className="text-sm font-medium text-zinc-700">
                                    Question
                                  </span>

                                  <textarea
                                    value={editedPrompt}
                                    onChange={(event) =>
                                      setEditedPrompt(event.target.value)
                                    }
                                    rows={4}
                                    className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950"
                                  />
                                </label>

                                <label className="mt-4 block">
                                  <span className="text-sm font-medium text-zinc-700">
                                    Answer outline
                                  </span>

                                  <textarea
                                    value={editedAnswerOutline}
                                    onChange={(event) =>
                                      setEditedAnswerOutline(event.target.value)
                                    }
                                    rows={5}
                                    className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950"
                                  />
                                </label>

                                {saveError && (
                                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                                    {saveError}
                                  </div>
                                )}

                                <div className="mt-4 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      saveQuestion(question.id)
                                    }
                                    disabled={isSavingQuestion}
                                    className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {isSavingQuestion
                                      ? "Saving..."
                                      : "Save changes"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={cancelEditingQuestion}
                                    disabled={isSavingQuestion}
                                    className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex min-w-0 gap-3">
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-xs font-semibold text-white">
                                      {index + 1}
                                    </span>

                                    <div className="min-w-0">
                                      <p className="font-medium leading-6 text-zinc-900">
                                        {question.prompt}
                                      </p>

                                      <div className="mt-2 flex flex-wrap gap-2">
                                        <select
                                          value={question.category}
                                          onChange={(event) =>
                                            void saveQuestionCategory(
                                              question.id,
                                              event.target.value as Question["category"]
                                            )
                                          }
                                          disabled={isSavingCategoryId === question.id}
                                          aria-label={`Category for question ${index + 1}`}
                                          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 outline-none transition focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          <option value="technical">Technical</option>
                                          <option value="behavioural">Behavioural</option>
                                          <option value="system-design">System Design</option>
                                          <option value="company-fit">Company Fit</option>
                                        </select>

                                        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
                                          Difficulty {question.difficulty}/3
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center justify-end gap-2">
                                    <span
                                      className="hidden select-none rounded-lg border border-dashed border-zinc-200 px-2.5 py-1.5 text-xs text-zinc-400 sm:inline-flex"
                                      aria-hidden="true"
                                    >
                                      ⋮⋮ Drag
                                    </span>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        startEditingQuestion(question)
                                      }
                                      disabled={isDeletingQuestionId === question.id}
                                      className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Edit
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => deleteQuestion(question.id)}
                                      disabled={isDeletingQuestionId === question.id}
                                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {isDeletingQuestionId === question.id
                                        ? "Deleting..."
                                        : "Delete"}
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-4 rounded-xl bg-zinc-50 p-4">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                    Answer outline
                                  </p>

                                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                                    {question.answer_outline}
                                  </p>
                                </div>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
                      <p className="text-sm font-medium text-zinc-800">
                        No interview questions were generated.
                      </p>
                      <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-zinc-500">
                        This can happen when the job description does not contain
                        enough reliable requirements to generate questions.
                      </p>
                    </div>
                  )}

                  {deleteQuestionError && (
                    <div
                      role="alert"
                      className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                    >
                      {deleteQuestionError}
                    </div>
                  )}

                  {deleteQuestionSuccess && (
                    <p
                      className="mt-4 text-sm text-zinc-600"
                      role="status"
                      aria-live="polite"
                    >
                      ✓ {deleteQuestionSuccess}
                    </p>
                  )}

                  {questionOrderError && (
                    <div
                      role="alert"
                      className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                    >
                      {questionOrderError}
                    </div>
                  )}

                  {questionOrderSuccess && (
                    <p
                      className="mt-4 text-sm text-zinc-600"
                      role="status"
                      aria-live="polite"
                    >
                      ✓ {questionOrderSuccess}
                    </p>
                  )}

                  {categorySaveError && (
                    <div
                      role="alert"
                      className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                    >
                      {categorySaveError}
                    </div>
                  )}

                  {categorySaveSuccess && (
                    <p
                      className="mt-4 text-sm text-zinc-600"
                      role="status"
                      aria-live="polite"
                    >
                      ✓ {categorySaveSuccess}
                    </p>
                  )}
                </section>
              </div>
            </details>

            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm outline-none transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2">
                <span className="text-base font-semibold text-zinc-950">
                  Flashcards
                </span>
                <span
                  className="shrink-0 text-sm text-zinc-500 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                >
                  ▾
                </span>
              </summary>

              <div className="mt-3">
                <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div>
                      <h2 className="text-xl font-semibold">
                        Flashcards
                      </h2>

                      <p className="mt-1 text-sm text-zinc-500">
                        Quick revision material based on the job requirements.
                      </p>
                    </div>

                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">
                      {data.flashcards.length} cards
                    </span>
                  </div>

                  {data.flashcards.length > 0 ? (
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      {data.flashcards.map((flashcard) => {
                        const isEditing = editingFlashcardId === flashcard.id;

                        return (
                          <article
                            key={flashcard.id}
                            className="rounded-xl border border-zinc-200 p-5"
                          >
                            {isEditing ? (
                              <div>
                                <div className="mb-4 flex items-center justify-between gap-3">
                                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                    Flashcard
                                  </span>

                                  <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
                                    {flashcard.id}
                                  </span>
                                </div>

                                <label className="block">
                                  <span className="text-sm font-medium text-zinc-700">
                                    Question
                                  </span>

                                  <textarea
                                    value={editedFront}
                                    onChange={(event) =>
                                      setEditedFront(event.target.value)
                                    }
                                    rows={3}
                                    className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950"
                                  />
                                </label>

                                <label className="mt-4 block">
                                  <span className="text-sm font-medium text-zinc-700">
                                    Answer
                                  </span>

                                  <textarea
                                    value={editedBack}
                                    onChange={(event) =>
                                      setEditedBack(event.target.value)
                                    }
                                    rows={5}
                                    className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950"
                                  />
                                </label>

                                {flashcardSaveError && (
                                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                                    {flashcardSaveError}
                                  </div>
                                )}

                                <div className="mt-4 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => saveFlashcard(flashcard.id)}
                                    disabled={isSavingFlashcard}
                                    className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {isSavingFlashcard
                                      ? "Saving..."
                                      : "Save changes"}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={cancelEditingFlashcard}
                                    disabled={isSavingFlashcard}
                                    className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-start justify-between gap-4">
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                      Question
                                    </p>

                                    <h3 className="mt-2 font-medium leading-6 text-zinc-900">
                                      {flashcard.front}
                                    </h3>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      startEditingFlashcard(flashcard)
                                    }
                                    className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                                  >
                                    Edit
                                  </button>
                                </div>

                                <div className="my-4 border-t border-zinc-100" />

                                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                  Answer
                                </p>

                                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                                  {flashcard.back}
                                </p>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
                      <p className="text-sm font-medium text-zinc-800">
                        No flashcards were generated.
                      </p>
                      <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-zinc-500">
                        Flashcards depend on extracted requirements, so a thin job
                        description may produce fewer or no cards.
                      </p>
                    </div>
                  )}
                </section>
              </div>
            </details>

            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm outline-none transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2">
                <span className="text-base font-semibold text-zinc-950">
                  Coverage
                </span>
                <span
                  className="shrink-0 text-sm text-zinc-500 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                >
                  ▾
                </span>
              </summary>

              <div className="mt-3">
                <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-semibold">Coverage</h2>

                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl bg-zinc-50 p-4">
                      <p className="text-sm text-zinc-500">
                        Requirements
                      </p>

                      <p className="mt-1 text-2xl font-semibold">
                        {data.role.requirements.length}
                      </p>
                    </div>

                    <div className="rounded-xl bg-zinc-50 p-4">
                      <p className="text-sm text-zinc-500">
                        Coverage passes
                      </p>

                      <p className="mt-1 text-2xl font-semibold">
                        {data.coverage.passes}
                      </p>
                    </div>

                    <div className="rounded-xl bg-zinc-50 p-4">
                      <p className="text-sm text-zinc-500">
                        Uncovered requirements
                      </p>

                      <p className="mt-1 text-2xl font-semibold">
                        {data.coverage.uncovered_requirement_ids.length}
                      </p>
                    </div>
                  </div>

                  {data.coverage.uncovered_requirement_ids.length === 0 ? (
                    <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                      All required interview areas are covered.
                    </div>
                  ) : (
                    <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                      Some requirements are not currently covered by generated
                      questions.
                    </div>
                  )}
                </section>
              </div>
            </details>
          </div>
        )}
      </div>

      <style jsx global>{`
          button:focus-visible,
          a:focus-visible,
          select:focus-visible,
          textarea:focus-visible,
          input:focus-visible,
          [tabindex="0"]:focus-visible {
            outline: 2px solid #18181b;
            outline-offset: 2px;
          }
        `}</style>
    </main>
  );
}