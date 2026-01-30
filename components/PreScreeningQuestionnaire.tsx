'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronRight,
  ChevronLeft,
  User,
  Heart,
  Activity,
  Cigarette,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import {
  QuestionnaireAnswers,
  AgeRange,
  MedicalCondition,
  CurrentHealthStatus,
  LifestyleFactor,
  LastCheckup,
  SuddenEvent,
  getDefaultAnswers
} from '@/lib/questionnaireLogic';
import { useLanguage } from '@/lib/i18n';

interface PreScreeningQuestionnaireProps {
  onComplete: (answers: QuestionnaireAnswers) => void;
  onSkip: () => void;
}

type QuestionStep = 1 | 2 | 3 | 4 | 5 | 6;

export function PreScreeningQuestionnaire({
  onComplete,
  onSkip
}: PreScreeningQuestionnaireProps) {
  const { t, language } = useLanguage();
  const [step, setStep] = useState<QuestionStep>(1);
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(getDefaultAnswers());

  const totalSteps = 6;

  const handleNext = () => {
    if (step < 6) {
      setStep((step + 1) as QuestionStep);
    } else {
      onComplete(answers);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep((step - 1) as QuestionStep);
    }
  };

  const handleAgeSelect = (age: AgeRange) => {
    setAnswers({ ...answers, age });
  };

  const handleConditionToggle = (condition: MedicalCondition) => {
    const current = answers.conditions;
    if (current.includes(condition)) {
      setAnswers({
        ...answers,
        conditions: current.filter(c => c !== condition)
      });
    } else {
      setAnswers({
        ...answers,
        conditions: [...current, condition]
      });
    }
  };

  const handleHealthSelect = (health: CurrentHealthStatus) => {
    setAnswers({ ...answers, currentHealth: health });
  };

  const handleLifestyleToggle = (factor: LifestyleFactor) => {
    const current = answers.lifestyle;
    if (current.includes(factor)) {
      setAnswers({
        ...answers,
        lifestyle: current.filter(f => f !== factor)
      });
    } else {
      setAnswers({
        ...answers,
        lifestyle: [...current, factor]
      });
    }
  };

  const handleCheckupSelect = (checkup: LastCheckup) => {
    setAnswers({ ...answers, lastCheckup: checkup });
  };

  const handleSuddenEventToggle = (event: SuddenEvent) => {
    const current = answers.suddenEvents;

    // If selecting "no_sudden_event", clear all other events
    if (event === 'no_sudden_event') {
      setAnswers({
        ...answers,
        suddenEvents: ['no_sudden_event']
      });
    } else {
      // If selecting an event, remove "no_sudden_event" and toggle the event
      const filtered = current.filter(e => e !== 'no_sudden_event');
      if (filtered.includes(event)) {
        const updated = filtered.filter(e => e !== event);
        setAnswers({
          ...answers,
          suddenEvents: updated.length === 0 ? ['no_sudden_event'] : updated
        });
      } else {
        setAnswers({
          ...answers,
          suddenEvents: [...filtered, event]
        });
      }
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-blue-100 dark:bg-blue-900/50 rounded-full p-3">
                <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t('questionnaire.age.question')}
                </h3>
                <p className={`text-sm text-gray-500 dark:text-gray-400 ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t('questionnaire.age.hint')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(['under40', '40-55', '55-70', 'over70'] as AgeRange[]).map((age) => (
                <Button
                  key={age}
                  variant={answers.age === age ? 'default' : 'outline'}
                  className={`h-14 text-base ${language === 'ar' ? 'font-arabic' : ''} ${
                    answers.age === age ? 'bg-blue-600' : ''
                  }`}
                  onClick={() => handleAgeSelect(age)}
                >
                  {t(`questionnaire.age.${age}`)}
                </Button>
              ))}
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-red-100 dark:bg-red-900/50 rounded-full p-3">
                <Heart className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t('questionnaire.conditions.question')}
                </h3>
                <p className={`text-sm text-gray-500 dark:text-gray-400 ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t('questionnaire.conditions.hint')}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {(['hypertension', 'diabetes', 'heartDisease', 'previousStroke', 'familyHistory'] as MedicalCondition[]).map((condition) => (
                <Button
                  key={condition}
                  variant={answers.conditions.includes(condition) ? 'default' : 'outline'}
                  className={`w-full h-auto py-3 px-4 justify-start ${language === 'ar' ? 'font-arabic text-right' : 'text-left'} ${
                    answers.conditions.includes(condition) ? 'bg-blue-600' : ''
                  }`}
                  onClick={() => handleConditionToggle(condition)}
                >
                  <span className="flex items-center gap-2">
                    {answers.conditions.includes(condition) && (
                      <span className="text-white">✓</span>
                    )}
                    {t(`questionnaire.conditions.${condition}`)}
                  </span>
                </Button>
              ))}
            </div>

            {answers.conditions.length === 0 && (
              <p className={`text-center text-sm text-gray-500 dark:text-gray-400 mt-4 ${language === 'ar' ? 'font-arabic' : ''}`}>
                {t('questionnaire.conditions.noneSelected')}
              </p>
            )}
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-green-100 dark:bg-green-900/50 rounded-full p-3">
                <Activity className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t('questionnaire.health.question')}
                </h3>
                <p className={`text-sm text-gray-500 dark:text-gray-400 ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t('questionnaire.health.hint')}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {(['healthy', 'coldFlu', 'tired', 'unwellOther'] as CurrentHealthStatus[]).map((status) => (
                <Button
                  key={status}
                  variant={answers.currentHealth === status ? 'default' : 'outline'}
                  className={`w-full h-auto py-3 px-4 justify-start ${language === 'ar' ? 'font-arabic text-right' : 'text-left'} ${
                    answers.currentHealth === status ? 'bg-blue-600' : ''
                  }`}
                  onClick={() => handleHealthSelect(status)}
                >
                  {t(`questionnaire.health.${status}`)}
                </Button>
              ))}
            </div>
          </motion.div>
        );

      case 4:
        return (
          <motion.div
            key="step4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-orange-100 dark:bg-orange-900/50 rounded-full p-3">
                <Cigarette className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t('questionnaire.lifestyle.question')}
                </h3>
                <p className={`text-sm text-gray-500 dark:text-gray-400 ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t('questionnaire.lifestyle.hint')}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {(['smoker', 'highStress', 'poorDiet'] as LifestyleFactor[]).map((factor) => (
                <Button
                  key={factor}
                  variant={answers.lifestyle.includes(factor) ? 'default' : 'outline'}
                  className={`w-full h-auto py-3 px-4 justify-start ${language === 'ar' ? 'font-arabic text-right' : 'text-left'} ${
                    answers.lifestyle.includes(factor) ? 'bg-blue-600' : ''
                  }`}
                  onClick={() => handleLifestyleToggle(factor)}
                >
                  <span className="flex items-center gap-2">
                    {answers.lifestyle.includes(factor) && (
                      <span className="text-white">✓</span>
                    )}
                    {t(`questionnaire.lifestyle.${factor}`)}
                  </span>
                </Button>
              ))}
            </div>

            {answers.lifestyle.length === 0 && (
              <p className={`text-center text-sm text-gray-500 dark:text-gray-400 mt-4 ${language === 'ar' ? 'font-arabic' : ''}`}>
                {t('questionnaire.lifestyle.noneSelected')}
              </p>
            )}
          </motion.div>
        );

      case 5:
        return (
          <motion.div
            key="step5"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-purple-100 dark:bg-purple-900/50 rounded-full p-3">
                <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t('questionnaire.checkup.question')}
                </h3>
                <p className={`text-sm text-gray-500 dark:text-gray-400 ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t('questionnaire.checkup.hint')}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {(['within6Months', '6to12Months', 'over1Year', 'never'] as LastCheckup[]).map((checkup) => (
                <Button
                  key={checkup}
                  variant={answers.lastCheckup === checkup ? 'default' : 'outline'}
                  className={`w-full h-auto py-3 px-4 justify-start ${language === 'ar' ? 'font-arabic text-right' : 'text-left'} ${
                    answers.lastCheckup === checkup ? 'bg-blue-600' : ''
                  }`}
                  onClick={() => handleCheckupSelect(checkup)}
                >
                  {t(`questionnaire.checkup.${checkup}`)}
                </Button>
              ))}
            </div>
          </motion.div>
        );

      case 6:
        return (
          <motion.div
            key="step6"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-red-100 dark:bg-red-900/50 rounded-full p-3">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t('questionnaire.suddenEvents.question')}
                </h3>
                <p className={`text-sm text-gray-500 dark:text-gray-400 ${language === 'ar' ? 'font-arabic' : ''}`}>
                  {t('questionnaire.suddenEvents.hint')}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {(['sudden_weakness', 'sudden_confusion', 'sudden_headache', 'no_sudden_event'] as SuddenEvent[]).map((event) => (
                <Button
                  key={event}
                  variant={answers.suddenEvents.includes(event) ? 'default' : 'outline'}
                  className={`w-full h-auto py-3 px-4 justify-start ${language === 'ar' ? 'font-arabic text-right' : 'text-left'} ${
                    answers.suddenEvents.includes(event) ? (event === 'no_sudden_event' ? 'bg-blue-600' : 'bg-red-600') : ''
                  }`}
                  onClick={() => handleSuddenEventToggle(event)}
                >
                  <span className="flex items-center gap-2">
                    {answers.suddenEvents.includes(event) && (
                      <span className="text-white">✓</span>
                    )}
                    {t(`questionnaire.suddenEvents.${event}`)}
                  </span>
                </Button>
              ))}
            </div>

            {!answers.suddenEvents.includes('no_sudden_event') && answers.suddenEvents.length > 0 && (
              <p className={`text-center text-sm text-red-600 dark:text-red-400 mt-4 font-semibold ${language === 'ar' ? 'font-arabic' : ''}`}>
                ⚠️ {t('questionnaire.suddenEvents.warningMessage')}
              </p>
            )}
          </motion.div>
        );
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className={`text-xl ${language === 'ar' ? 'font-arabic' : ''}`}>
            {t('questionnaire.title')}
          </CardTitle>
          <Badge variant="outline" className={`text-sm ${language === 'ar' ? 'font-arabic' : ''}`}>
            {language === 'ar' ? `${totalSteps} من ${step}` : `${step} of ${totalSteps}`}
          </Badge>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-4">
          <motion.div
            className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(step / totalSteps) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </CardHeader>

      <CardContent>
        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>

        {/* Navigation buttons */}
        <div className="flex justify-between mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div>
            {step > 1 ? (
              <Button variant="ghost" onClick={handleBack} className={language === 'ar' ? 'font-arabic' : ''}>
                <ChevronLeft className={`h-4 w-4 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
                {t('common.back')}
              </Button>
            ) : (
              <Button variant="ghost" onClick={onSkip} className={`text-gray-500 dark:text-gray-400 ${language === 'ar' ? 'font-arabic' : ''}`}>
                {t('questionnaire.skipQuestionnaire')}
              </Button>
            )}
          </div>

          <Button onClick={handleNext} className={language === 'ar' ? 'font-arabic' : ''}>
            {step === 6 ? t('questionnaire.continueToRecording') : t('common.next')}
            <ChevronRight className={`h-4 w-4 ${language === 'ar' ? 'mr-1' : 'ml-1'}`} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
