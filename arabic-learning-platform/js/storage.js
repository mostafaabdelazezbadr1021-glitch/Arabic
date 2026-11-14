/**
 * إدارة التخزين المحلي (LocalStorage) وحفظ تقدم الطالب وسجل الإنجازات
 * يعمل محلياً بنسبة 100% دون الحاجة لأي حساب أو خادم أو قاعدة بيانات سحابية.
 */

window.StorageManager = (function() {
  const STORAGE_KEY = "arabic_platform_student_state_v1";

  // الأوسمة وشارات الإنجاز التحفيزية
  const BADGES_DEFINITIONS = [
    {
      id: "badge-first-step",
      title: "أول الغيث",
      description: "إتمام قراءة أول درس في المنهج بنجاح",
      icon: "footprints",
      condition: state => (state.completedLessons || []).length >= 1
    },
    {
      id: "badge-reading-master",
      title: "فارس المطالعة",
      description: "إتمام جميع دروس القراءة الثلاثة المقررة",
      icon: "book-open",
      condition: state => {
        const completed = state.completedLessons || [];
        return ["reading-1", "reading-2", "reading-3"].every(id => completed.includes(id));
      }
    },
    {
      id: "badge-poetry-lover",
      title: "راوية الأشعار",
      description: "إتمام دراسة نصوص الأدب والبلاغة الثلاثة",
      icon: "feather",
      condition: state => {
        const completed = state.completedLessons || [];
        return ["texts-1", "texts-2", "texts-3"].every(id => completed.includes(id));
      }
    },
    {
      id: "badge-curriculum-grammar",
      title: "ضابط القواعد",
      description: "إتمام دروس نحو المنهج وقواعد الكتابة",
      icon: "check-check",
      condition: state => {
        const completed = state.completedLessons || [];
        return ["curriculum-grammar-1", "curriculum-grammar-2", "curriculum-grammar-3", "curriculum-grammar-4", "spelling-1", "spelling-2"].every(id => completed.includes(id));
      }
    },
    {
      id: "badge-placement-done",
      title: "بصير بقدراته",
      description: "اجتياز اختبار تحديد المستوى النحوي",
      icon: "compass",
      condition: state => !!state.placementTestResult
    },
    {
      id: "badge-quiz-ace",
      title: "قاهر الاختبارات",
      description: "إتمام 3 اختبارات قصيرة بنسبة لا تقل عن 80%",
      icon: "zap",
      condition: state => {
        const highScores = (state.quizHistory || []).filter(q => (q.score / q.total) >= 0.8);
        return highScores.length >= 3;
      }
    },
    {
      id: "badge-exam-champion",
      title: "سيد الامتحانات",
      description: "اجتياز الامتحان النموذجي الشامل بنجاح",
      icon: "award",
      condition: state => {
        return (state.examHistory || []).some(e => e.examId === "exam-comprehensive-term-1" && (e.score / e.total) >= 0.6);
      }
    },
    {
      id: "badge-grammar-foundations",
      title: "سيبويه المعاصر",
      description: "إتمام 6 محطات في التأسيس النحوي التراكمي",
      icon: "graduation-cap",
      condition: state => (state.completedGrammarStages || []).length >= 6
    }
  ];

  function getDefaultState() {
    return {
      completedLessons: [],
      completedGrammarStages: [],
      quizHistory: [],
      examHistory: [],
      placementTestResult: null,
      bookmarks: [],
      xp: 0,
      theme: "light",
      unlockedBadges: [],
      lastActive: new Date().toISOString()
    };
  }

  function loadState() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return getDefaultState();
      const parsed = JSON.parse(data);
      return { ...getDefaultState(), ...parsed };
    } catch (err) {
      console.warn("تنبيه: تعذر قراءة بيانات التخزين المحلي، سيتم استعادة الحالة الافتراضية.", err);
      return getDefaultState();
    }
  }

  function saveState(state) {
    try {
      state.lastActive = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error("خطأ أثناء حفظ البيانات في التخزين المحلي:", err);
    }
  }

  return {
    getState: loadState,

    markLessonComplete: function(lessonId) {
      const state = loadState();
      if (!state.completedLessons.includes(lessonId)) {
        state.completedLessons.push(lessonId);
        state.xp = (state.xp || 0) + 50;
        this.checkBadges(state);
        saveState(state);
      }
      return state;
    },

    isLessonCompleted: function(lessonId) {
      const state = loadState();
      return (state.completedLessons || []).includes(lessonId);
    },

    markGrammarStageComplete: function(stageId) {
      const state = loadState();
      if (!state.completedGrammarStages.includes(stageId)) {
        state.completedGrammarStages.push(stageId);
        state.xp = (state.xp || 0) + 40;
        this.checkBadges(state);
        saveState(state);
      }
      return state;
    },

    recordQuizResult: function(quizRecord) {
      const state = loadState();
      if (!state.quizHistory) state.quizHistory = [];
      state.quizHistory.unshift({
        ...quizRecord,
        id: "quiz-" + Date.now(),
        date: new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      });
      // إضافة نقاط خبرة بحسب الإجابات الصحيحة
      state.xp = (state.xp || 0) + (quizRecord.score * 10);
      this.checkBadges(state);
      saveState(state);
      return state;
    },

    recordExamResult: function(examRecord) {
      const state = loadState();
      if (!state.examHistory) state.examHistory = [];
      state.examHistory.unshift({
        ...examRecord,
        id: "exam-" + Date.now(),
        date: new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      });
      state.xp = (state.xp || 0) + (examRecord.score * 15);
      this.checkBadges(state);
      saveState(state);
      return state;
    },

    savePlacementResult: function(result) {
      const state = loadState();
      state.placementTestResult = {
        ...result,
        date: new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
      };
      state.xp = (state.xp || 0) + 75;
      this.checkBadges(state);
      saveState(state);
      return state;
    },

    checkBadges: function(state) {
      if (!state.unlockedBadges) state.unlockedBadges = [];
      let newBadgeUnlocked = null;

      BADGES_DEFINITIONS.forEach(b => {
        if (!state.unlockedBadges.includes(b.id)) {
          if (b.condition(state)) {
            state.unlockedBadges.push(b.id);
            newBadgeUnlocked = b;
          }
        }
      });

      return newBadgeUnlocked;
    },

    getAllBadges: function() {
      const state = loadState();
      const unlockedIds = state.unlockedBadges || [];
      return BADGES_DEFINITIONS.map(b => ({
        ...b,
        isUnlocked: unlockedIds.includes(b.id)
      }));
    },

    getOverallStats: function() {
      const state = loadState();
      const totalCurriculumLessons = 12; // 3 قراءة + 3 نصوص + 4 نحو + 2 كتابة
      const completedCount = (state.completedLessons || []).length;
      const curriculumPercentage = Math.min(100, Math.round((completedCount / totalCurriculumLessons) * 100));
      
      const totalGrammarStages = 12;
      const completedGrammar = (state.completedGrammarStages || []).length;
      const grammarPercentage = Math.min(100, Math.round((completedGrammar / totalGrammarStages) * 100));

      const quizCount = (state.quizHistory || []).length;
      const examCount = (state.examHistory || []).length;

      // حساب معدل النجاح
      let totalQuestionsAnswered = 0;
      let totalCorrect = 0;
      (state.quizHistory || []).forEach(q => {
        totalQuestionsAnswered += q.total || 0;
        totalCorrect += q.score || 0;
      });
      (state.examHistory || []).forEach(e => {
        totalQuestionsAnswered += e.total || 0;
        totalCorrect += e.score || 0;
      });

      const overallAccuracy = totalQuestionsAnswered > 0 ? Math.round((totalCorrect / totalQuestionsAnswered) * 100) : 0;

      return {
        curriculumPercentage,
        grammarPercentage,
        completedCount,
        totalCurriculumLessons,
        completedGrammar,
        totalGrammarStages,
        quizCount,
        examCount,
        totalQuestionsAnswered,
        totalCorrect,
        overallAccuracy,
        xp: state.xp || 0,
        placementResult: state.placementTestResult
      };
    },

    saveTheme: function(theme) {
      const state = loadState();
      state.theme = theme;
      saveState(state);
    },

    getTheme: function() {
      return loadState().theme || "light";
    },

    resetAllData: function() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.warn("resetAllData error:", e);
      }
      return getDefaultState();
    }
  };
})();
