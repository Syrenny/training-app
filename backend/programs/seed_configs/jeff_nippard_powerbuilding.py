from .common import A, B, D, INFO, P, REST, S, BW, I, build_notes, set_item

POWERBUILDING_WEEK_1 = {
    1: {
        "title": "1 неделя",
        "days": [
            {
                "weekday": "MON",
                "title": "Фулбоди 1: присед, жим стоя",
                "exercises": [
                    {
                        "name": "Приседания",
                        "category": S,
                        "sets": [set_item(P, 75, 5, 1, load_value_max=80)],
                        "notes": build_notes(
                            4,
                            "Сконцентрируйтесь на технике и взрывном усилии.",
                            rpe=7.5,
                        ),
                    },
                    {
                        "name": "Приседания",
                        "category": S,
                        "sets": [set_item(P, 70, 8, 2)],
                        "notes": build_notes(
                            0,
                            "Сохраняйте одинаковый наклон корпуса и технику во всех повторениях.",
                        ),
                    },
                    {
                        "name": "Жим штанги стоя",
                        "category": B,
                        "sets": [set_item(P, 70, 8, 3)],
                        "notes": build_notes(
                            2,
                            "Полностью перезапускайте каждое повторение, без touch-and-press.",
                        ),
                    },
                    {
                        "name": "Подъем корпуса в GHR",
                        "category": A,
                        "sets": [set_item(I, None, 8, 3, reps_max=10)],
                        "notes": build_notes(
                            1,
                            "Держите таз ровно. Если нет тренажера GHR, замените на нордические сгибания.",
                            rpe=7,
                        ),
                    },
                    {
                        "name": "Тяга Хелмса",
                        "category": A,
                        "sets": [set_item(I, None, 12, 3, reps_max=15)],
                        "notes": build_notes(
                            1,
                            "Строгая техника. Ведите локти вверх и назад примерно под углом 45 градусов.",
                            rpe=9,
                        ),
                    },
                    {
                        "name": "Молотки",
                        "category": A,
                        "sets": [set_item(I, None, 20, 3, reps_max=25)],
                        "notes": build_notes(
                            0,
                            "Держите локти зафиксированными и сильно сжимайте рукоять гантели.",
                            rpe=10,
                        ),
                    },
                ],
            },
            {
                "weekday": "TUE",
                "title": "Фулбоди 2: тяга, жим лежа",
                "exercises": [
                    {
                        "name": "Становая тяга",
                        "category": D,
                        "sets": [set_item(P, 80, 4, 3)],
                        "notes": build_notes(
                            4,
                            "Тяните классикой или сумо, в зависимости от того, где вы сильнее.",
                        ),
                    },
                    {
                        "name": "Жим штанги лежа",
                        "category": B,
                        "sets": [set_item(P, 82.5, 3, 1, load_value_max=87.5)],
                        "notes": build_notes(
                            4,
                            "Топ-сет. Оставляйте 1, максимум 2 повтора в запасе. Тяжелый подход.",
                            rpe=8.5,
                        ),
                    },
                    {
                        "name": "Жим штанги лежа",
                        "category": B,
                        "sets": [set_item(P, 67.5, 10, 2)],
                        "notes": build_notes(
                            0,
                            "На каждом повторении делайте быструю паузу на груди примерно в 1 секунду.",
                        ),
                    },
                    {
                        "name": "Отведение бедра",
                        "category": A,
                        "sets": [set_item(I, None, 15, 3, reps_max=20)],
                        "notes": build_notes(
                            0,
                            "Можно делать в тренажере, с резинкой или с отягощением. Вверху удерживайте 1 секунду.",
                            rpe=9,
                        ),
                    },
                    {
                        "name": "Подтягивания",
                        "category": A,
                        "sets": [set_item(I, None, 5, 3, reps_max=8)],
                        "notes": build_notes(
                            1,
                            "Хват примерно в полтора раза шире плеч, тянитесь грудью к перекладине.",
                            rpe=8,
                        ),
                    },
                    {
                        "name": "Французский жим лежа на полу",
                        "category": A,
                        "sets": [set_item(I, None, 10, 3, reps_max=12)],
                        "notes": build_notes(
                            1,
                            "Уводите штангу за голову, слегка касайтесь пола за собой в нижней точке.",
                            rpe=8,
                        ),
                    },
                    {
                        "name": "Подъем на носки стоя",
                        "category": A,
                        "sets": [set_item(I, None, 8, 3, reps_max=10)],
                        "notes": build_notes(
                            1,
                            "Внизу делайте паузу 1-2 секунды и работайте в полной амплитуде.",
                            rpe=9,
                        ),
                    },
                ],
                "text_blocks": [
                    {
                        "kind": REST,
                        "content": "Рекомендуемый день отдыха: 1-2 дня без тренировок, в зависимости от вашего расписания.",
                    },
                ],
            },
            {
                "weekday": "THU",
                "title": "Фулбоди 3: присед, брусья",
                "exercises": [
                    {
                        "name": "Приседания",
                        "category": S,
                        "sets": [set_item(P, 80, 4, 3)],
                        "notes": build_notes(
                            4,
                            "Сохраняйте плотное давление верхом спины в штангу.",
                        ),
                    },
                    {
                        "name": "Отжимания на брусьях",
                        "category": A,
                        "sets": [set_item(I, None, 8, 3)],
                        "notes": build_notes(
                            2,
                            "Если нет доступа к брусьям, замените на жим гантелей лежа на полу.",
                            rpe=8,
                        ),
                    },
                    {
                        "name": "Подъем ног в висе",
                        "category": A,
                        "sets": [set_item(BW, None, 10, 3, reps_max=12)],
                        "notes": build_notes(
                            0,
                            "Подтягивайте колени к груди, двигайтесь подконтрольно. Для усложнения сильнее выпрямляйте ноги.",
                            rpe=9,
                        ),
                    },
                    {
                        "name": "Пуловер на широчайшие",
                        "category": A,
                        "sets": [set_item(I, None, 12, 3, reps_max=15)],
                        "notes": build_notes(
                            1,
                            "Можно делать с гантелью, на блоке с канатом или с резинкой. Растягивайте и прожимайте широчайшие.",
                            rpe=8,
                        ),
                    },
                    {
                        "name": "Сгибание рук с гантелями на наклонной скамье",
                        "category": A,
                        "sets": [set_item(I, None, 12, 3, reps_max=15)],
                        "notes": build_notes(
                            1,
                            "Делайте по одной руке, а не поочередно, и начинайте со слабой руки.",
                            rpe=9,
                        ),
                    },
                    {
                        "name": "Тяга к лицу",
                        "category": A,
                        "sets": [set_item(I, None, 15, 4, reps_max=20)],
                        "notes": build_notes(
                            0,
                            "Можно использовать блок с канатом или резинку. Ведя движение, сводите лопатки.",
                            rpe=9,
                        ),
                    },
                ],
            },
            {
                "weekday": "FRI",
                "title": "Фулбоди 4: тяга, жим лежа",
                "exercises": [
                    {
                        "name": "Становая тяга с паузой",
                        "category": D,
                        "sets": [set_item(P, 75, 2, 4)],
                        "notes": build_notes(
                            4,
                            "Делайте паузу на 3 секунды сразу после отрыва блинов от пола.",
                        ),
                    },
                    {
                        "name": "Жим штанги лежа с паузой",
                        "category": B,
                        "sets": [set_item(P, 75, 5, 3)],
                        "notes": build_notes(
                            3,
                            "Фиксируйте штангу на груди на 2-3 секунды.",
                        ),
                    },
                    {
                        "name": "Тяга T-грифа с упором грудью или тяга Пендлея",
                        "category": A,
                        "sets": [set_item(I, None, 10, 3)],
                        "notes": build_notes(
                            1,
                            "Следите, чтобы не перегружать поясницу. Работайте легко и минимизируйте читинг.",
                            rpe=7,
                        ),
                    },
                    {
                        "name": "Нордические сгибания",
                        "category": A,
                        "sets": [set_item(BW, None, 6, 3, reps_max=8)],
                        "notes": build_notes(
                            0,
                            "При необходимости замените на сгибания ног лежа.",
                            rpe=8,
                        ),
                    },
                    {
                        "name": "Шраги с гантелями",
                        "category": A,
                        "sets": [set_item(I, None, 20, 3, reps_max=25)],
                        "notes": build_notes(
                            0,
                            "Внизу почувствуйте растяжение трапеций, вверху сильно сократите их.",
                            rpe=9,
                        ),
                    },
                ],
                "text_blocks": [
                    {
                        "kind": REST,
                        "content": "Рекомендуемый день отдыха: 1-2 дня без тренировок, в зависимости от вашего расписания.",
                    },
                    {
                        "kind": INFO,
                        "content": "Если у вас есть возможность добавить пятый тренировочный день и вы хотите сделать акцент на гипертрофии рук, можно добавить отдельный день рук и гипертрофии.",
                    },
                ],
            },
        ],
    }
}

PROGRAM_CONFIG = {
    "slug": "jeff-nippard-powerbuilding",
    "name": "Jeff Nippard Powerbuilding",
    "description": "",
    "format": "structured",
    "weeks": POWERBUILDING_WEEK_1,
    "one_rep_max_exercises": [
        {"name": "Приседания", "category": S, "label": "Приседания"},
        {"name": "Жим штанги лежа", "category": B, "label": "Жим штанги лежа"},
        {"name": "Жим штанги стоя", "category": B, "label": "Жим штанги стоя"},
        {"name": "Становая тяга", "category": D, "label": "Становая тяга"},
    ],
    "one_rep_max_category_sources": {
        S: "Приседания",
        B: "Жим штанги лежа",
        D: "Становая тяга",
    },
    "one_rep_max_sources": {
        "Жим штанги стоя": "Жим штанги стоя",
        "Жим штанги лежа с паузой": "Жим штанги лежа",
        "Становая тяга с паузой": "Становая тяга",
    },
}
