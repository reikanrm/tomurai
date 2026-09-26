import { addDays, daysBetween, validDate } from './calendar.ts';
import type { GuidancePlan, GuidanceTask, TaskProgress } from './guidance-model';

const categories = {
  general: { ja: '手続きの確認', en: 'Procedure checks' },
  firstWeek: { ja: '初七日', en: 'Seventh-day service' },
  fortyNine: { ja: '四十九日', en: 'Forty-nine-day service' },
  burial: { ja: '納骨', en: 'Interment' },
  thanks: { ja: '香典返し', en: 'Condolence returns' },
  belongings: { ja: '遺品整理', en: 'Sorting belongings' },
} as const;

type TaskInput = Omit<
  GuidanceTask,
  'done' | 'assignee' | 'optional' | 'needsConfirmation' | 'guidanceDate' | 'scheduledDate'
> & Partial<Pick<
  GuidanceTask,
  'done' | 'assignee' | 'optional' | 'needsConfirmation' | 'guidanceDate' | 'scheduledDate'
>>;

function task(input: TaskInput): GuidanceTask {
  return {
    done: false,
    assignee: null,
    optional: false,
    needsConfirmation: false,
    guidanceDate: null,
    scheduledDate: null,
    ...input,
  };
}

function guidanceDates(plan: GuidancePlan) {
  const firstWeek = addDays(plan.deathDate, 6);
  const fortyNine = addDays(plan.deathDate, 48);
  let scheduledFortyNine: string | null = null;

  if (validDate(plan.fortyNineDate)) {
    const fromDeath = validDate(plan.deathDate)
      ? daysBetween(plan.deathDate, plan.fortyNineDate)
      : null;
    if (fromDeath === null || fromDeath >= 0) scheduledFortyNine = plan.fortyNineDate;
  }

  return { firstWeek, fortyNine, scheduledFortyNine };
}

function generalTasks(): GuidanceTask[] {
  return [
    task({
      id: 'receive-medical-certificate',
      title: { ja: '死亡診断書の受け取りを確認する', en: 'Check how to receive the medical certificate' },
      description: {
        ja: '医療機関や葬儀社に、受け取り方法と必要な部数を確認します。',
        en: 'Ask the medical provider or funeral service how to receive it and how many copies may be needed.',
      },
      category: categories.general,
      group: 'general',
      needsConfirmation: true,
    }),
    task({
      id: 'confirm-death-registration',
      title: { ja: '死亡届の提出状況を確認する', en: 'Check the status of death registration' },
      description: {
        ja: '提出済みか、誰がどこへ提出するかを確認します。この表示だけで届出完了とは扱いません。',
        en: 'Check whether it has been filed and who will file it where. This task alone does not complete the registration.',
      },
      category: categories.general,
      group: 'general',
      needsConfirmation: true,
    }),
    task({
      id: 'confirm-bank-inheritance',
      title: { ja: '銀行の相続手続きを確認する', en: 'Check the bank inheritance process' },
      description: {
        ja: '取引先の有無と、各金融機関で必要な案内を確認します。口座番号などはこの画面へ入力しません。',
        en: 'Check which institutions were used and what each one requires. Do not enter account numbers on this screen.',
      },
      category: categories.general,
      group: 'general',
      needsConfirmation: true,
    }),
    task({
      id: 'review-service-contracts',
      title: { ja: '契約中のサービスを確認する', en: 'Review ongoing service contracts' },
      description: {
        ja: '継続中の契約と、解約や名義変更が必要かを各社に確認します。',
        en: 'Review ongoing contracts and ask each provider whether cancellation or a name change is needed.',
      },
      category: categories.general,
      group: 'general',
      needsConfirmation: true,
    }),
  ];
}

function firstWeekTasks(plan: GuidancePlan, guidanceDate: string | null): GuidanceTask[] {
  if (plan.firstWeekDone === 'notNeeded') return [];

  if (plan.firstWeekDone === 'yes') {
    return [task({
      id: 'first-week-service',
      title: { ja: '初七日法要', en: 'Seventh-day service' },
      description: {
        ja: '実施済みとして確認されています。葬儀当日に行った場合も、準備タスクを重ねて作りません。',
        en: 'Recorded as completed. No duplicate preparation tasks are added when it was held on the funeral day.',
      },
      category: categories.firstWeek,
      group: 'first-week',
      done: true,
      optional: true,
      guidanceDate,
      completionKey: 'firstWeekDone',
    })];
  }

  const unknown = plan.firstWeekDone === 'unknown';
  const tasks = [
    task({
      id: 'first-week-confirm',
      title: { ja: '初七日の実施方法を確認する', en: 'Confirm plans for the seventh-day service' },
      description: {
        ja: '行うかどうか、時期や準備を寺院・葬儀社・ご家族などへ確認します。行わない選択もできます。',
        en: 'Ask the relevant religious contact, funeral service or family whether it will be held and what preparation is wanted. Choosing not to hold it is also possible.',
      },
      category: categories.firstWeek,
      group: 'first-week',
      optional: true,
      needsConfirmation: true,
      guidanceDate,
    }),
    task({
      id: 'first-week-service',
      title: { ja: '初七日法要を行う', en: 'Hold the seventh-day service' },
      description: {
        ja: '亡くなった日を1日目として7日目が目安です。読経・焼香を行う形や、ご家族だけでお参りする形などがあります。宗派・地域・ご家庭に合わせ、行わない場合は対象外にできます。',
        en: 'The seventh day, counting the date of death as day one, is a guide. Examples include chanting and offering incense or a simple family visit. Follow the family, region and tradition, or mark it as not applicable.',
      },
      category: categories.firstWeek,
      group: 'first-week',
      optional: true,
      needsConfirmation: unknown,
      guidanceDate,
      completionKey: 'firstWeekDone',
    }),
    task({
      id: 'first-week-offerings',
      title: { ja: '初七日のお供えが必要か確認する', en: 'Check whether offerings are wanted for the seventh-day service' },
      description: {
        ja: '必要な場合は、線香・ろうそく・果物・菓子など、用意するものを寺院等へ確認します。全国共通の必須品とは扱いません。',
        en: 'If offerings are wanted, ask the relevant religious contact whether to prepare items such as incense, candles, fruit or sweets. These are not treated as universally required items.',
      },
      category: categories.firstWeek,
      group: 'first-week',
      optional: true,
      needsConfirmation: true,
      guidanceDate,
    }),
  ];

  if (plan.firstWeekMeal !== 'no') {
    tasks.push(task({
      id: 'first-week-meal',
      title: { ja: '初七日の会食を確認する', en: 'Check meal arrangements for the seventh-day service' },
      description: {
        ja: '会食を行う場合だけ、人数や場所などを確認します。',
        en: 'Check numbers and location only if the family wants to arrange a meal.',
      },
      category: categories.firstWeek,
      group: 'first-week',
      optional: true,
      needsConfirmation: plan.firstWeekMeal === 'unknown',
      guidanceDate,
    }));
  }

  return tasks;
}

function choiceTask(
  choice: GuidancePlan['tablet'] | GuidancePlan['fortyNineMeal'] | GuidancePlan['gifts'] | GuidancePlan['eyeOpening'],
  yesTask: TaskInput,
  unknownTask: TaskInput,
): GuidanceTask | null {
  if (choice === 'no') return null;
  return task(choice === 'yes' ? yesTask : { ...unknownTask, needsConfirmation: true });
}

function fortyNineTasks(
  plan: GuidancePlan,
  guidanceDate: string | null,
  scheduledDate: string | null,
): GuidanceTask[] {
  const common = { category: categories.fortyNine, group: 'forty-nine' as const, optional: true, guidanceDate, scheduledDate };
  if (plan.fortyNineDone === 'notNeeded') return [];

  if (plan.fortyNineDone === 'yes') {
    const tasks = [task({
      id: 'forty-nine-service',
      title: { ja: '四十九日法要', en: 'Forty-nine-day service' },
      description: {
        ja: '実施済みとして確認されています。予定日の到来だけで完了にはしません。',
        en: 'Recorded as completed. Reaching a planned date alone never marks it complete.',
      },
      ...common,
      done: true,
      completionKey: 'fortyNineDone',
    })];

    if (plan.altar !== 'no') {
      tasks.push(task({
        id: 'forty-nine-altar',
        title: plan.altar === 'yes'
          ? { ja: '後飾り祭壇の片付け方を確認する', en: 'Check how to put away the temporary altar' }
          : { ja: '後飾り祭壇の片付けが必要か確認する', en: 'Check whether the temporary altar needs attention' },
        description: {
          ja: '祭壇がある場合だけ、片付ける時期と方法を寺院・葬儀社などへ確認します。',
          en: 'If there is a temporary altar, ask the relevant religious contact or funeral service when and how to put it away.',
        },
        ...common,
        needsConfirmation: plan.altar === 'unknown',
      }));
    }

    if (plan.tablet !== 'no') {
      tasks.push(task({
        id: 'forty-nine-tablet-after',
        title: plan.tablet === 'yes'
          ? { ja: '本位牌等を仏壇へ移す', en: 'Move the memorial tablet to the family altar' }
          : { ja: '本位牌等の扱いを寺院へ確認する', en: 'Ask how the memorial tablet should be handled' },
        description: {
          ja: '使用する場合だけ進めます。宗派によっては本位牌を用いません。',
          en: 'Do this only when relevant. Some traditions do not use a memorial tablet.',
        },
        ...common,
        needsConfirmation: plan.tablet === 'unknown',
      }));
    }
    return tasks;
  }

  const unknown = plan.fortyNineDone === 'unknown';
  const preparationTasks = [
    task({
      id: 'forty-nine-date',
      title: { ja: '四十九日法要の日程を決める', en: 'Set the date for the forty-nine-day service' },
      description: {
        ja: 'ご家族や寺院等と相談して日程を決めます。49日目より前の予定も選べます。',
        en: 'Choose the date with the family and relevant religious contact. The service may be planned before the forty-ninth day.',
      },
      ...common,
      needsConfirmation: unknown,
    }),
    task({
      id: 'forty-nine-place',
      title: { ja: '四十九日法要の場所を決める', en: 'Set the place for the forty-nine-day service' },
      description: {
        ja: '寺院、自宅、会場など、ご家庭に合う場所を確認します。',
        en: 'Confirm a suitable place, such as a temple, the family home or another venue.',
      },
      ...common,
      needsConfirmation: unknown,
    }),
    task({
      id: 'forty-nine-temple',
      title: { ja: '寺院等へ四十九日法要を依頼する', en: 'Contact the relevant religious provider about the forty-nine-day service' },
      description: {
        ja: '行う内容や時刻、当日までに必要な準備を寺院等へ確認します。',
        en: 'Ask the relevant religious provider about the service, timing and any preparation needed beforehand.',
      },
      ...common,
      needsConfirmation: unknown,
    }),
    task({
      id: 'forty-nine-attendees',
      title: { ja: '四十九日法要の参列者を確認する', en: 'Confirm attendees for the forty-nine-day service' },
      description: {
        ja: 'ご家庭の希望に合わせて参列者を決め、必要な方へ日程と場所を連絡します。',
        en: 'Decide who will attend based on the family\'s wishes, then share the date and place with them.',
      },
      ...common,
      needsConfirmation: unknown,
    }),
  ];

  const tabletTask = choiceTask(plan.tablet, {
    id: 'forty-nine-tablet',
    title: { ja: '本位牌等を準備する', en: 'Prepare the memorial tablet if used' },
    description: { ja: '使用する場合だけ準備します。', en: 'Prepare it only when the family uses one.' },
    ...common,
  }, {
    id: 'forty-nine-tablet',
    title: { ja: '本位牌等が必要か寺院へ確認する', en: 'Ask whether a memorial tablet is used' },
    description: { ja: '宗派によっては使用しないため、購入前に確認します。', en: 'Some traditions do not use one, so ask before purchasing anything.' },
    ...common,
  });
  if (tabletTask) preparationTasks.push(tabletTask);

  if (plan.fortyNineMeal === 'yes') {
    preparationTasks.push(task({
      id: 'forty-nine-meal-arrangements',
      title: { ja: '四十九日の会食を手配する', en: 'Arrange the meal for the forty-nine-day service' },
      description: { ja: '会食を予定している場合だけ、人数、場所、料理などを確認して手配します。', en: 'When a meal is planned, confirm the number of people, place and menu, then make the arrangements.' },
      ...common,
    }));
  } else if (plan.fortyNineMeal === 'unknown') {
    preparationTasks.push(task({
      id: 'forty-nine-meal-confirm',
      title: { ja: '四十九日の会食を行うか確認する', en: 'Check whether a meal will be arranged' },
      description: { ja: '会食は必須ではありません。ご家庭で行うかを先に確認します。', en: 'A meal is not required; first check whether the family wants one.' },
      ...common,
      needsConfirmation: true,
    }));
  }

  const giftsTask = choiceTask(plan.gifts, {
    id: 'forty-nine-gifts',
    title: { ja: '四十九日の返礼品を準備する', en: 'Prepare return gifts for the forty-nine-day service' },
    description: { ja: '予定している場合だけ準備し、全国共通の金額基準は表示しません。', en: 'Prepare them only when planned; no universal amount is shown.' },
    ...common,
  }, {
    id: 'forty-nine-gifts',
    title: { ja: '四十九日の返礼品が必要か確認する', en: 'Check whether return gifts are wanted' },
    description: { ja: '地域やご家庭により異なるため、必要性を確認します。', en: 'Practices vary by family and region, so check whether they are wanted.' },
    ...common,
  });
  if (giftsTask) preparationTasks.push(giftsTask);

  const dayTasks = [
    task({
      id: 'forty-nine-service',
      title: { ja: '四十九日法要を行う', en: 'Hold the forty-nine-day service' },
      description: {
        ja: '亡くなった日を1日目として49日目が目安です。読経・焼香を行う形や、ご家族だけでお参りする形などがあり、実際の予定日は目安日と別に扱います。',
        en: 'The forty-ninth day, counting the date of death as day one, is a guide. Examples include chanting and offering incense or a simple family visit; the actual planned date is kept separate from this guide.',
      },
      ...common,
      needsConfirmation: unknown,
      completionKey: 'fortyNineDone',
    }),
    task({
      id: 'forty-nine-offering',
      title: { ja: 'お布施等を準備・渡す', en: 'Prepare and give any offering or honorarium' },
      description: {
        ja: '必要性や金額を寺院等へ確認します。必要な場合は御車代・御膳料も確認し、当日に渡せるよう準備します。全国共通の基準とは扱いません。',
        en: 'Ask the relevant religious contact whether an offering is expected and about the amount. If applicable, also ask about travel or meal honoraria and prepare them to hand over on the day; no universal standard is assumed.',
      },
      ...common,
      needsConfirmation: true,
    }),
  ];

  if (plan.fortyNineMeal === 'yes') {
    dayTasks.push(task({
      id: 'forty-nine-meal-day',
      title: { ja: '四十九日の会食を行う', en: 'Hold the meal after the forty-nine-day service' },
      description: { ja: '予定している場合だけ、法要当日に参列者をご案内します。', en: 'When planned, guide attendees to the meal on the day of the service.' },
      ...common,
    }));
  }

  const eyeOpeningTask = choiceTask(plan.eyeOpening, {
    id: 'forty-nine-eye-opening',
    title: { ja: '開眼供養等を行う', en: 'Hold the eye-opening ceremony if applicable' },
    description: { ja: '該当する場合だけ、寺院等と確認した方法で当日に行います。', en: 'When applicable, hold it on the day in the manner confirmed with the relevant religious contact.' },
    ...common,
  }, {
    id: 'forty-nine-eye-opening',
    title: { ja: '開眼供養等が必要か確認する', en: 'Check whether an eye-opening ceremony applies' },
    description: { ja: '宗派や準備物により異なるため、寺院等へ確認します。', en: 'Ask the relevant religious contact because practices and items differ.' },
    ...common,
  });
  if (eyeOpeningTask) dayTasks.push(eyeOpeningTask);

  return [...preparationTasks, ...dayTasks];
}

function burialTasks(plan: GuidancePlan, guidanceDate: string | null): GuidanceTask[] {
  const common = { category: categories.burial, group: 'burial' as const, optional: true };
  if (plan.burial === 'none') return [];
  if (plan.burial === 'done') {
    return [task({
      id: 'burial-service',
      title: { ja: '納骨', en: 'Interment' },
      description: { ja: '実施済みとして確認されています。', en: 'Recorded as completed.' },
      ...common,
      done: true,
      completionKey: 'burial',
    })];
  }
  if (plan.burial === 'later' || plan.burial === 'unknown') {
    return [task({
      id: 'burial-plan',
      title: { ja: '納骨の予定を確認する', en: 'Check plans for interment' },
      description: {
        ja: '四十九日とは別の時期でもかまいません。ご家族と納骨先に相談し、日程や場所を決めましょう。',
        en: 'Interment can take place at another time. Discuss the date and place with your family and the interment destination.',
      },
      ...common,
      needsConfirmation: plan.burial === 'unknown',
    })];
  }

  const tasks = [
    task({
      id: 'burial-arrangements',
      title: { ja: '納骨の日程・場所を確認する', en: 'Confirm the date and place for interment' },
      description: {
        ja: 'ご家庭の希望に合う日程と納骨先を確認します。四十九日は納骨の期限ではありません。',
        en: 'Confirm a date and interment destination that suit the family. The forty-nine-day date is not an interment deadline.',
      },
      ...common,
      guidanceDate,
    }),
    task({
      id: 'burial-contact',
      title: { ja: '寺院・霊園等へ納骨について連絡する', en: 'Contact the temple, cemetery or other interment destination' },
      description: {
        ja: '納骨先へ連絡し、予約方法、当日の流れ、必要な準備を確認します。',
        en: 'Contact the destination to confirm booking, the process on the day and any preparation needed.',
      },
      ...common,
      guidanceDate,
    }),
    task({
      id: 'burial-documents',
      title: { ja: '納骨に必要な書類を確認する', en: 'Check documents needed for interment' },
      description: {
        ja: '火葬済の記載がある埋火葬許可証など、必要な書類を納骨先へ確認します。改葬・分骨等では異なります。',
        en: 'Ask the destination which documents are needed, such as a cremation-certified burial or cremation permit. Reinterment and division of ashes may differ.',
      },
      ...common,
      guidanceDate,
      needsConfirmation: true,
    }),
    task({
      id: 'burial-service',
      title: { ja: '納骨を行う', en: 'Complete the interment' },
      description: {
        ja: '実際に行ったことを確認した時だけ完了にします。予定日の到来では完了にしません。',
        en: 'Mark this complete only after confirming it took place, never merely because a planned date arrived.',
      },
      ...common,
      guidanceDate,
      completionKey: 'burial',
    }),
  ];

  if (plan.engraving !== 'no') {
    tasks.splice(2, 0, task({
      id: 'burial-engraving',
      title: plan.engraving === 'yes'
        ? { ja: '追加彫刻等を手配する', en: 'Arrange any additional engraving' }
        : { ja: '追加彫刻等が必要か確認する', en: 'Check whether additional engraving is needed' },
      description: {
        ja: '納骨先から必要と案内された場合だけ進めます。',
        en: 'Proceed only when the interment destination says it is needed.',
      },
      ...common,
      guidanceDate,
      needsConfirmation: plan.engraving === 'unknown',
    }));
  }
  return tasks;
}

function returnTasks(plan: GuidancePlan): GuidanceTask[] {
  if (plan.returnsDone === 'notNeeded') return [];
  const done = plan.returnsDone === 'yes';
  const unknown = plan.returnsDone === 'unknown';
  return [task({
    id: 'condolence-returns',
    title: unknown
      ? { ja: '香典返しの状況を確認する', en: 'Check the status of condolence returns' }
      : done
        ? { ja: '香典返し', en: 'Condolence returns' }
        : { ja: '香典返しを準備・発送する', en: 'Prepare and send condolence returns' },
    description: unknown
      ? { ja: '対応が必要か、済んだ分と残っている分があるかを確認します。', en: 'Check whether action is needed and whether any recipients still remain.' }
      : done
        ? { ja: 'すべて対応済みとして確認されています。', en: 'Recorded as fully completed.' }
        : { ja: '忌明けを目安にする例があります。品物や挨拶状の準備、発送時期は地域やご家庭に合わせて確認します。', en: 'Some families use the end of the mourning period as a guide. Confirm the gifts, greeting note and timing with the family and local practice.' },
    category: categories.thanks,
    group: 'thanks',
    done,
    optional: true,
    needsConfirmation: unknown,
    completionKey: 'returnsDone',
  })];
}

function belongingsTask(): GuidanceTask {
  return task({
    id: 'belongings-check',
    title: { ja: '遺品整理の進め方を確認する', en: 'Review how to sort belongings' },
    description: {
      ja: '相続放棄・限定承認を検討中、または相続するか未定の場合は、財産の売却・譲渡・廃棄などの前に弁護士等へ確認してください。物や行為、状況によって扱いが異なります。',
      en: 'If renunciation or limited acceptance is being considered, or inheritance is undecided, consult a lawyer before selling, transferring or disposing of property. The treatment depends on the item, action and circumstances.',
    },
    category: categories.belongings,
    group: 'belongings',
    optional: true,
  });
}

/** Derive visible tasks without mutating the confirmed answers or saved progress. */
export function deriveGuidanceTasks(plan: GuidancePlan): GuidanceTask[] {
  const dates = guidanceDates(plan);
  const tasks = generalTasks();

  if (plan.rituals === 'unknown') {
    tasks.push(task({
      id: 'confirm-ritual-guidance',
      title: { ja: '法要・ご供養の案内を確認する', en: 'Choose whether to see ritual and remembrance guidance' },
      description: {
        ja: '法要の候補を表示するか、表示しないか、あとで確認するかを選べます。',
        en: 'Choose whether to show ritual suggestions, hide them, or decide later.',
      },
      category: categories.firstWeek,
      group: 'first-week',
      optional: true,
      needsConfirmation: true,
    }));
  } else if (plan.rituals === 'yes') {
    tasks.push(...firstWeekTasks(plan, dates.firstWeek));
    tasks.push(...fortyNineTasks(plan, dates.fortyNine, dates.scheduledFortyNine));
  }

  tasks.push(...burialTasks(plan, dates.fortyNine));
  tasks.push(...returnTasks(plan));
  tasks.push(belongingsTask());
  return tasks;
}

/** Apply in-memory progress. Plan-backed completion remains the source of truth. */
export function applyTaskProgress(tasks: GuidanceTask[], progress: TaskProgress): GuidanceTask[] {
  return tasks.map(current => {
    const saved = progress[current.id];
    if (!saved) return current;
    return {
      ...current,
      done: current.completionKey || typeof saved.done !== 'boolean' ? current.done : saved.done,
      assignee: saved.assignee === undefined ? current.assignee : saved.assignee,
    };
  });
}
