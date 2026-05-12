(function () {
  const form = document.getElementById("program-editor-form");
  if (!form) {
    return;
  }

  const ormContainer = document.getElementById("one-rep-max-editor");
  const sidebarContainer = document.getElementById("program-structure-sidebar");
  const weekEditorContainer = document.getElementById("program-week-editor");
  const dayEditorContainer = document.getElementById("program-day-editor");
  const emptyStateContainer = document.getElementById("program-editor-empty");
  const statusBar = document.getElementById("program-editor-status");
  const statusItem = document.getElementById("program-editor-status-item");
  const statusText = document.getElementById("program-editor-status-text");
  const statusActions = document.getElementById("program-editor-status-actions");
  const ormField = document.getElementById("id_one_rep_max_config");
  const structureField = document.getElementById("id_structure");
  const fieldRowTemplate = document.getElementById("program-editor-field-row-template");

  const state = JSON.parse(document.getElementById("program-editor-state").textContent);
  const exerciseCatalog = JSON.parse(document.getElementById("program-editor-exercises").textContent);
  const weekdayChoices = JSON.parse(document.getElementById("program-editor-weekdays").textContent);
  const loadTypeChoices = JSON.parse(document.getElementById("program-editor-load-types").textContent);
  const textBlockKindChoices = JSON.parse(document.getElementById("program-editor-text-kinds").textContent);

  const weekdayOrder = weekdayChoices.map((item) => item.value);
  const storageKey = form.dataset.storageKey;
  const isServerBoundState = form.dataset.formBound === "true";
  const metaFieldNames = ["name", "slug", "description", "owner", "source_program"];

  let activeWeekIndex = 0;
  const activeDayIndexes = {};
  let isDirty = false;
  let isSubmitting = false;
  let dragState = null;
  let draftSaveTimer = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getByPath(path) {
    if (!path) {
      return state;
    }
    return path.split(".").reduce((current, part) => {
      if (/^\d+$/.test(part)) {
        return current[Number(part)];
      }
      return current[part];
    }, state);
  }

  function renderOptions(items, selectedValue, options) {
    const settings = options || {};
    const result = [];
    if (settings.allowBlank) {
      const blankValue = settings.blankValue || "";
      const blankLabel = settings.blankLabel || "---------";
      const selected = selectedValue === null || selectedValue === undefined || selectedValue === "";
      result.push(
        `<option value="${escapeHtml(blankValue)}"${selected ? " selected" : ""}>${escapeHtml(blankLabel)}</option>`,
      );
    }
    for (const item of items) {
      const selected = String(item.value) === String(selectedValue ?? "") ? " selected" : "";
      result.push(`<option value="${escapeHtml(item.value)}"${selected}>${escapeHtml(item.label)}</option>`);
    }
    return result.join("");
  }

  function renderExerciseOptions(selectedValue, allowBlank) {
    return renderOptions(
      exerciseCatalog.map((exercise) => ({
        value: exercise.id,
        label: `${exercise.name} (${exercise.category_label})`,
      })),
      selectedValue,
      {
        allowBlank: Boolean(allowBlank),
        blankLabel: "Не выбрано",
      },
    );
  }

  function getExerciseName(exerciseId) {
    return exerciseCatalog.find((item) => String(item.id) === String(exerciseId))?.name || "Упражнение";
  }

  function buildInputId(path, field) {
    return `id_${path}_${field}`.replace(/[^a-zA-Z0-9_-]+/g, "_");
  }

  function buildInputName(path, field) {
    return `${path}.${field}`;
  }

  function renderFieldRow(label, path, field, controlHtml, options) {
    const settings = options || {};
    const fieldName = settings.fieldName || field;
    const fragment = fieldRowTemplate.content.cloneNode(true);
    const row = fragment.querySelector(".form-row");
    const container = fragment.querySelector(".flex-container");
    const labelElement = fragment.querySelector("label");

    if (fieldName) {
      row.classList.add(`field-${fieldName}`);
    }
    if (settings.required) {
      labelElement.classList.add("required");
    }

    labelElement.setAttribute("for", buildInputId(path, field));
    labelElement.textContent = `${label}:`;
    container.insertAdjacentHTML("beforeend", controlHtml);

    if (settings.help) {
      fragment.querySelector(".form-row > div").insertAdjacentHTML(
        "beforeend",
        `<div class="help">${escapeHtml(settings.help)}</div>`,
      );
    }

    const wrapper = document.createElement("div");
    wrapper.appendChild(fragment);
    return wrapper.innerHTML;
  }

  function renderBlockHeader(title, subtitle, actionsHtml, level) {
    const headingTag = level || "h3";
    return `
      <div class="program-editor-block-header">
        <div>
          <${headingTag}>${escapeHtml(title)}</${headingTag}>
          ${subtitle ? `<div class="program-editor-note">${escapeHtml(subtitle)}</div>` : ""}
        </div>
        ${
          actionsHtml
            ? `<div class="editor-inline-actions">${actionsHtml}</div>`
            : ""
        }
      </div>
    `;
  }

  function renderSectionTitle(title, actionsHtml) {
    return `
      <div class="program-editor-section-title">
        <h2>${escapeHtml(title)}</h2>
        ${
          actionsHtml
            ? `<div class="submit-row">${actionsHtml}</div>`
            : ""
        }
      </div>
    `;
  }

  function renderFieldsetHeader(title, subtitle, actionsHtml) {
    return `
      <div class="program-editor-fieldset-header">
        <div>
          <h2>${escapeHtml(title)}</h2>
          ${subtitle ? `<div class="program-editor-note">${escapeHtml(subtitle)}</div>` : ""}
        </div>
        ${
          actionsHtml
            ? `<div class="editor-inline-actions">${actionsHtml}</div>`
            : ""
        }
      </div>
    `;
  }

  function renderSimpleEmptyModule(title, subtitle, actionsHtml) {
    return `
      <section class="module">
        <h2>${escapeHtml(title)}</h2>
        <div class="program-editor-empty-module-body">
          ${subtitle ? `<div class="program-editor-note">${escapeHtml(subtitle)}</div>` : ""}
          ${
            actionsHtml
              ? `<div class="editor-inline-actions">${actionsHtml}</div>`
              : ""
          }
        </div>
      </section>
    `;
  }

  function getWeekLabel(week, weekIndex) {
    const title = String(week.title || "").trim();
    return title || `Неделя ${weekIndex + 1}`;
  }

  function getDayLabel(day) {
    const weekday = weekdayChoices.find((item) => item.value === day.weekday)?.label || day.weekday;
    const title = String(day.title || "").trim();
    return title ? `${weekday} · ${title}` : weekday;
  }

  function getMetaField(name) {
    return form.elements.namedItem(name);
  }

  function readMetaFields() {
    const fields = {};
    for (const fieldName of metaFieldNames) {
      const field = getMetaField(fieldName);
      if (!field) {
        continue;
      }
      fields[fieldName] = field.value;
    }
    return fields;
  }

  function restoreMetaFields(fields) {
    for (const fieldName of metaFieldNames) {
      const field = getMetaField(fieldName);
      if (!field || !Object.prototype.hasOwnProperty.call(fields, fieldName)) {
        continue;
      }
      field.value = fields[fieldName] ?? "";
    }
  }

  function serializeState() {
    ormField.value = JSON.stringify(state.one_rep_max_config);
    structureField.value = JSON.stringify({ weeks: state.structure.weeks });
  }

  function serializeDraft() {
    return {
      version: 1,
      saved_at: Date.now(),
      fields: readMetaFields(),
      one_rep_max_config: state.one_rep_max_config,
      structure: state.structure,
      ui: {
        activeWeekIndex,
        activeDayIndexes,
      },
    };
  }

  function readDraft() {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }
      if (!parsed.structure || !Array.isArray(parsed.structure.weeks) || !Array.isArray(parsed.one_rep_max_config)) {
        return null;
      }
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function writeDraft() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(serializeDraft()));
      renderStatus("Черновик сохранен локально.", "dirty");
      renderStatusActions();
    } catch (error) {
      renderStatus("Не удалось сохранить локальный черновик.", "warning");
    }
  }

  function removeDraft() {
    try {
      window.localStorage.removeItem(storageKey);
    } catch (error) {
      return;
    }
  }

  function scheduleDraftSave() {
    window.clearTimeout(draftSaveTimer);
    draftSaveTimer = window.setTimeout(writeDraft, 180);
  }

  function renderStatus(message, tone) {
    statusText.textContent = message;
    if (!statusItem) {
      return;
    }
    statusItem.className = "info";
    if (tone === "dirty") {
      statusItem.className = "warning";
    }
    if (tone === "warning") {
      statusItem.className = "error";
    }
  }

  function renderStatusActions() {
    const draft = readDraft();
    if (!draft || isServerBoundState) {
      statusActions.innerHTML = "";
      return;
    }

    const savedAt = draft.saved_at ? new Date(draft.saved_at) : null;
    const savedLabel = savedAt ? savedAt.toLocaleString() : "без времени";
    statusActions.innerHTML = `
      <span class="program-editor-note">Найден локальный черновик: ${escapeHtml(savedLabel)}</span>
      <button type="button" class="button" data-action="restore-draft">Восстановить</button>
      <button type="button" class="button" data-action="discard-draft">Удалить</button>
    `;
  }

  function createDefaultSet() {
    return {
      load_type: "PERCENT",
      load_value: 0,
      load_value_max: null,
      reps: 5,
      reps_max: null,
      sets: 1,
    };
  }

  function createDefaultExercise() {
    const firstExercise = exerciseCatalog[0];
    return {
      exercise: firstExercise ? firstExercise.id : null,
      one_rep_max_exercise: null,
      superset_group: null,
      notes: "",
      sets: [createDefaultSet()],
    };
  }

  function createDefaultTextBlock() {
    return {
      kind: "INFO",
      content: "",
    };
  }

  function nextWeekdayValue(week, currentWeekday) {
    const used = new Set(
      (week.days || [])
        .map((item) => item.weekday)
        .filter((value) => value && value !== currentWeekday),
    );
    for (const weekday of weekdayOrder) {
      if (!used.has(weekday)) {
        return weekday;
      }
    }
    return null;
  }

  function createDefaultDay(week) {
    return {
      weekday: nextWeekdayValue(week, null) || weekdayOrder[0],
      title: "",
      exercises: [createDefaultExercise()],
      text_blocks: [],
    };
  }

  function createDefaultWeek() {
    return {
      title: "",
      days: [],
    };
  }

  function createDefaultOrm() {
    return {
      exercise_id: exerciseCatalog[0] ? exerciseCatalog[0].id : null,
      label: "",
    };
  }

  function clampActiveWeekIndex() {
    if (!state.structure.weeks.length) {
      activeWeekIndex = 0;
      return;
    }
    if (activeWeekIndex < 0) {
      activeWeekIndex = 0;
      return;
    }
    if (activeWeekIndex >= state.structure.weeks.length) {
      activeWeekIndex = state.structure.weeks.length - 1;
    }
  }

  function clampActiveDayIndex(weekIndex) {
    const week = state.structure.weeks[weekIndex];
    if (!week || !week.days.length) {
      activeDayIndexes[weekIndex] = 0;
      return;
    }
    const currentIndex = activeDayIndexes[weekIndex] ?? 0;
    if (currentIndex < 0) {
      activeDayIndexes[weekIndex] = 0;
      return;
    }
    if (currentIndex >= week.days.length) {
      activeDayIndexes[weekIndex] = week.days.length - 1;
      return;
    }
    activeDayIndexes[weekIndex] = currentIndex;
  }

  function syncActiveIndexes() {
    clampActiveWeekIndex();
    state.structure.weeks.forEach((_, weekIndex) => clampActiveDayIndex(weekIndex));
  }

  function moveListItem(list, fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) {
      return;
    }
    const item = list.splice(fromIndex, 1)[0];
    list.splice(toIndex, 0, item);
  }

  function markDirty(message) {
    isDirty = true;
    renderStatus(message || "Есть несохраненные изменения. Черновик сохраняется локально.", "dirty");
    scheduleDraftSave();
  }

  function setObjectValue(path, field, target) {
    const object = getByPath(path);
    const rawValue = target.value;

    if (target.dataset.valueType === "int") {
      object[field] = rawValue === "" ? null : Number(rawValue);
      return;
    }
    if (target.dataset.valueType === "decimal") {
      object[field] = rawValue === "" ? null : Number(rawValue);
      return;
    }
    object[field] = rawValue;
  }

  function renderOrmEditor() {
    if (!state.one_rep_max_config.length) {
      ormContainer.innerHTML = `<p class="editor-empty-hint">Конфиг 1ПМ пока пуст.</p>`;
      return;
    }

    ormContainer.innerHTML = state.one_rep_max_config
      .map((item, index) => {
        const itemPath = `one_rep_max_config.${index}`;
        return `
          <fieldset
            class="module aligned editor-orm-item"
            draggable="true"
            data-drag-kind="orm"
            data-drop-kind="orm"
            data-index="${index}"
          >
            ${renderFieldsetHeader(
              `1ПМ ${index + 1}`,
              getExerciseName(item.exercise_id),
              `<span class="editor-drag-handle" title="Перетащить">⋮⋮</span>
               <button type="button" class="button" data-action="remove-orm" data-index="${index}">Удалить</button>`,
            )}
            ${renderFieldRow(
              "Упражнение",
              itemPath,
              "exercise_id",
              `<select id="${buildInputId(itemPath, "exercise_id")}" name="${buildInputName(itemPath, "exercise_id")}" required data-path="${itemPath}" data-field="exercise_id">
                ${renderExerciseOptions(item.exercise_id, false)}
              </select>`,
              { required: true },
            )}
            ${renderFieldRow(
              "Подпись",
              itemPath,
              "label",
              `<input type="text" class="vTextField" id="${buildInputId(itemPath, "label")}" name="${buildInputName(itemPath, "label")}" value="${escapeHtml(item.label)}" data-path="${itemPath}" data-field="label">`,
            )}
          </fieldset>
        `;
      })
      .join("");
  }

  function renderSidebar() {
    if (!state.structure.weeks.length) {
      sidebarContainer.innerHTML = `<p class="editor-empty-hint">Добавьте неделю, чтобы собрать структуру программы.</p>`;
      return;
    }

    sidebarContainer.className = "program-structure-sidebar";
    sidebarContainer.innerHTML = state.structure.weeks
      .map((week, weekIndex) => {
        const isActiveWeek = weekIndex === activeWeekIndex;
        return `
          <section
            class="editor-week-nav-group${isActiveWeek ? " is-active" : ""}"
            draggable="true"
            data-drag-kind="week"
            data-drop-kind="week"
            data-week-index="${weekIndex}"
          >
            <div class="editor-week-nav-header">
              <button type="button" class="editor-week-nav-button" data-action="select-week" data-index="${weekIndex}">
                <strong>${escapeHtml(getWeekLabel(week, weekIndex))}</strong>
                <span>${week.days.length} дн.</span>
              </button>
              <div class="editor-week-nav-actions">
                <span class="editor-drag-handle" title="Перетащить">⋮⋮</span>
                <button type="button" class="button" data-action="remove-week" data-index="${weekIndex}">Удалить</button>
              </div>
            </div>
            <div class="editor-day-nav-list">
              ${
                week.days.length
                  ? week.days
                      .map((day, dayIndex) => {
                        const isActiveDay = isActiveWeek && (activeDayIndexes[weekIndex] ?? 0) === dayIndex;
                        return `
                          <div
                            class="editor-day-nav-item${isActiveDay ? " is-active" : ""}"
                            draggable="true"
                            data-drag-kind="day"
                            data-drop-kind="day"
                            data-week-index="${weekIndex}"
                            data-day-index="${dayIndex}"
                          >
                            <button
                              type="button"
                              class="editor-day-nav-button"
                              data-action="select-day"
                              data-week-index="${weekIndex}"
                              data-index="${dayIndex}"
                            >
                              <strong>${escapeHtml(getDayLabel(day))}</strong>
                              <span>${day.exercises.length} упр. · ${day.text_blocks.length} текста</span>
                            </button>
                            <div class="editor-inline-actions">
                              <span class="editor-drag-handle" title="Перетащить">⋮⋮</span>
                              <button type="button" class="button" data-action="remove-day" data-week-index="${weekIndex}" data-day-index="${dayIndex}">Удалить</button>
                            </div>
                          </div>
                        `;
                      })
                      .join("")
                  : `<p class="editor-empty-hint">В неделе пока нет дней.</p>`
              }
              <div class="editor-sidebar-actions">
                <input type="button" value="+ День" data-action="add-day" data-week-index="${weekIndex}">
              </div>
            </div>
          </section>
        `;
      })
      .join("");
  }

  function renderSetRows(weekIndex, dayIndex, exerciseIndex, setItems) {
    const listPath = `structure.weeks.${weekIndex}.days.${dayIndex}.exercises.${exerciseIndex}.sets`;
    return setItems
      .map((setItem, setIndex) => {
        const itemPath = `${listPath}.${setIndex}`;
        return `
          <tr
            class="editor-set-row"
            draggable="true"
            data-drag-kind="set"
            data-drop-kind="set"
            data-week-index="${weekIndex}"
            data-day-index="${dayIndex}"
            data-exercise-index="${exerciseIndex}"
            data-set-index="${setIndex}"
          >
            <td><span class="editor-drag-handle" title="Перетащить">⋮⋮</span></td>
            <td>
              <select id="${buildInputId(itemPath, "load_type")}" name="${buildInputName(itemPath, "load_type")}" data-path="${itemPath}" data-field="load_type">
                ${renderOptions(loadTypeChoices, setItem.load_type)}
              </select>
            </td>
            <td><input type="number" id="${buildInputId(itemPath, "load_value")}" name="${buildInputName(itemPath, "load_value")}" step="0.1" value="${setItem.load_value !== null ? escapeHtml(setItem.load_value) : ""}" data-path="${itemPath}" data-field="load_value" data-value-type="decimal"></td>
            <td><input type="number" id="${buildInputId(itemPath, "load_value_max")}" name="${buildInputName(itemPath, "load_value_max")}" step="0.1" value="${setItem.load_value_max !== null ? escapeHtml(setItem.load_value_max) : ""}" data-path="${itemPath}" data-field="load_value_max" data-value-type="decimal"></td>
            <td><input type="number" id="${buildInputId(itemPath, "reps")}" name="${buildInputName(itemPath, "reps")}" min="1" value="${escapeHtml(setItem.reps)}" data-path="${itemPath}" data-field="reps" data-value-type="int"></td>
            <td><input type="number" id="${buildInputId(itemPath, "reps_max")}" name="${buildInputName(itemPath, "reps_max")}" min="1" value="${setItem.reps_max !== null ? escapeHtml(setItem.reps_max) : ""}" data-path="${itemPath}" data-field="reps_max" data-value-type="int"></td>
            <td><input type="number" id="${buildInputId(itemPath, "sets")}" name="${buildInputName(itemPath, "sets")}" min="1" value="${escapeHtml(setItem.sets)}" data-path="${itemPath}" data-field="sets" data-value-type="int"></td>
            <td>
              <div class="editor-inline-actions">
                <button type="button" class="button" data-action="remove-set" data-week-index="${weekIndex}" data-day-index="${dayIndex}" data-exercise-index="${exerciseIndex}" data-set-index="${setIndex}">Удалить</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function renderExerciseCard(weekIndex, dayIndex, exerciseItem, exerciseIndex) {
    const itemPath = `structure.weeks.${weekIndex}.days.${dayIndex}.exercises.${exerciseIndex}`;
    const exerciseName = getExerciseName(exerciseItem.exercise);
    return `
      <fieldset
        class="module aligned editor-exercise-card"
        draggable="true"
        data-drag-kind="exercise"
        data-drop-kind="exercise"
        data-week-index="${weekIndex}"
        data-day-index="${dayIndex}"
        data-exercise-index="${exerciseIndex}"
      >
        ${renderFieldsetHeader(
          `Упражнение ${exerciseIndex + 1}`,
          `${exerciseName} · ${exerciseItem.sets.length} подходов`,
          `<span class="editor-drag-handle" title="Перетащить">⋮⋮</span>
           <button type="button" class="button" data-action="remove-exercise" data-week-index="${weekIndex}" data-day-index="${dayIndex}" data-exercise-index="${exerciseIndex}">Удалить</button>`,
        )}
        ${renderFieldRow(
          "Упражнение",
          itemPath,
          "exercise",
          `<select id="${buildInputId(itemPath, "exercise")}" name="${buildInputName(itemPath, "exercise")}" required data-path="${itemPath}" data-field="exercise" data-rerender="true">
            ${renderExerciseOptions(exerciseItem.exercise, false)}
          </select>`,
          { required: true },
        )}
        ${renderFieldRow(
          "Привязка к 1ПМ",
          itemPath,
          "one_rep_max_exercise",
          `<select id="${buildInputId(itemPath, "one_rep_max_exercise")}" name="${buildInputName(itemPath, "one_rep_max_exercise")}" data-path="${itemPath}" data-field="one_rep_max_exercise">
            ${renderExerciseOptions(exerciseItem.one_rep_max_exercise, true)}
          </select>`,
        )}
        ${renderFieldRow(
          "Группа суперсета",
          itemPath,
          "superset_group",
          `<input type="number" id="${buildInputId(itemPath, "superset_group")}" name="${buildInputName(itemPath, "superset_group")}" min="1" value="${exerciseItem.superset_group !== null ? escapeHtml(exerciseItem.superset_group) : ""}" data-path="${itemPath}" data-field="superset_group" data-value-type="int">`,
        )}
        ${renderFieldRow(
          "Заметки",
          itemPath,
          "notes",
          `<textarea id="${buildInputId(itemPath, "notes")}" name="${buildInputName(itemPath, "notes")}" class="vLargeTextField" rows="2" data-path="${itemPath}" data-field="notes">${escapeHtml(exerciseItem.notes)}</textarea>`,
        )}
        ${renderBlockHeader(
          "Подходы",
          "",
          `<input type="button" value="+ Подход" data-action="add-set" data-week-index="${weekIndex}" data-day-index="${dayIndex}" data-exercise-index="${exerciseIndex}">`,
        )}
        <div class="form-row">
          <div>
            <div class="editor-set-table-wrap">
              <table class="editor-set-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Тип</th>
                    <th>От</th>
                    <th>До</th>
                    <th>Повт.</th>
                    <th>До повт.</th>
                    <th>Подходов</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${renderSetRows(weekIndex, dayIndex, exerciseIndex, exerciseItem.sets)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </fieldset>
    `;
  }

  function renderTextBlockCard(weekIndex, dayIndex, textBlock, textIndex) {
    const itemPath = `structure.weeks.${weekIndex}.days.${dayIndex}.text_blocks.${textIndex}`;
    return `
      <fieldset
        class="module aligned editor-text-card"
        draggable="true"
        data-drag-kind="text-block"
        data-drop-kind="text-block"
        data-week-index="${weekIndex}"
        data-day-index="${dayIndex}"
        data-text-index="${textIndex}"
      >
        ${renderFieldsetHeader(
          `Текстовый блок ${textIndex + 1}`,
          textBlock.kind,
          `<span class="editor-drag-handle" title="Перетащить">⋮⋮</span>
           <button type="button" class="button" data-action="remove-text-block" data-week-index="${weekIndex}" data-day-index="${dayIndex}" data-text-index="${textIndex}">Удалить</button>`,
        )}
        ${renderFieldRow(
          "Тип блока",
          itemPath,
          "kind",
          `<select id="${buildInputId(itemPath, "kind")}" name="${buildInputName(itemPath, "kind")}" required data-path="${itemPath}" data-field="kind">
            ${renderOptions(textBlockKindChoices, textBlock.kind)}
          </select>`,
          { required: true },
        )}
        ${renderFieldRow(
          "Текст",
          itemPath,
          "content",
          `<textarea id="${buildInputId(itemPath, "content")}" name="${buildInputName(itemPath, "content")}" class="vLargeTextField" rows="3" data-path="${itemPath}" data-field="content">${escapeHtml(textBlock.content)}</textarea>`,
        )}
      </fieldset>
    `;
  }

  function renderWeekEditor() {
    if (!state.structure.weeks.length) {
      weekEditorContainer.innerHTML = "";
      return;
    }

    const week = state.structure.weeks[activeWeekIndex];
    weekEditorContainer.innerHTML = `
      <fieldset class="module aligned program-editor-workspace">
        ${renderFieldsetHeader(
          "Неделя",
          `${getWeekLabel(week, activeWeekIndex)} · ${week.days.length} дней`,
          `<button type="button" class="button" data-action="remove-week" data-index="${activeWeekIndex}">Удалить</button>`,
        )}
        ${renderFieldRow(
          "Заголовок недели",
          `structure.weeks.${activeWeekIndex}`,
          "title",
          `<input type="text" class="vTextField" id="${buildInputId(`structure.weeks.${activeWeekIndex}`, "title")}" name="${buildInputName(`structure.weeks.${activeWeekIndex}`, "title")}" value="${escapeHtml(week.title)}" data-path="structure.weeks.${activeWeekIndex}" data-field="title" data-rerender="true">`,
        )}
      </fieldset>
    `;
  }

  function renderDayEditor() {
    if (!state.structure.weeks.length) {
      dayEditorContainer.innerHTML = "";
      return;
    }

    const week = state.structure.weeks[activeWeekIndex];
    const activeDayIndex = activeDayIndexes[activeWeekIndex] ?? 0;

    if (!week.days.length) {
      dayEditorContainer.innerHTML = renderSimpleEmptyModule(
        "День",
        "В неделе пока нет дней. Добавьте день и начинайте собирать тренировку.",
        `<input type="button" value="+ День" data-action="add-day" data-week-index="${activeWeekIndex}">`,
      );
      return;
    }

    const day = week.days[activeDayIndex];
    dayEditorContainer.innerHTML = `
      <fieldset class="module aligned program-editor-day-panel">
        ${renderFieldsetHeader(
          "День",
          `${getDayLabel(day)} · ${day.exercises.length} упражнений · ${day.text_blocks.length} текстовых блоков`,
          `<button type="button" class="button" data-action="remove-day" data-week-index="${activeWeekIndex}" data-day-index="${activeDayIndex}">Удалить</button>`,
        )}
        ${renderFieldRow(
          "День недели",
          `structure.weeks.${activeWeekIndex}.days.${activeDayIndex}`,
          "weekday",
          `<select id="${buildInputId(`structure.weeks.${activeWeekIndex}.days.${activeDayIndex}`, "weekday")}" name="${buildInputName(`structure.weeks.${activeWeekIndex}.days.${activeDayIndex}`, "weekday")}" required data-path="structure.weeks.${activeWeekIndex}.days.${activeDayIndex}" data-field="weekday" data-rerender="true">
            ${renderOptions(weekdayChoices, day.weekday)}
          </select>`,
          { required: true },
        )}
        ${renderFieldRow(
          "Заголовок дня",
          `structure.weeks.${activeWeekIndex}.days.${activeDayIndex}`,
          "title",
          `<input type="text" class="vTextField" id="${buildInputId(`structure.weeks.${activeWeekIndex}.days.${activeDayIndex}`, "title")}" name="${buildInputName(`structure.weeks.${activeWeekIndex}.days.${activeDayIndex}`, "title")}" value="${escapeHtml(day.title)}" data-path="structure.weeks.${activeWeekIndex}.days.${activeDayIndex}" data-field="title" data-rerender="true">`,
        )}
      </fieldset>
      <section class="module">
        ${renderSectionTitle(
          "Упражнения дня",
          `<input type="button" value="+ Упражнение" data-action="add-exercise" data-week-index="${activeWeekIndex}" data-day-index="${activeDayIndex}">`,
        )}
        <div class="editor-card-list">
          ${
            day.exercises.length
              ? day.exercises
                  .map((exerciseItem, exerciseIndex) => renderExerciseCard(activeWeekIndex, activeDayIndex, exerciseItem, exerciseIndex))
                  .join("")
              : `<p class="editor-empty-hint">В этом дне пока нет упражнений.</p>`
          }
        </div>
      </section>
      <section class="module">
        ${renderSectionTitle(
          "Текстовые блоки",
          `<input type="button" value="+ Текстовый блок" data-action="add-text-block" data-week-index="${activeWeekIndex}" data-day-index="${activeDayIndex}">`,
        )}
        <div class="editor-card-list">
          ${
            day.text_blocks.length
              ? day.text_blocks
                  .map((textBlock, textIndex) => renderTextBlockCard(activeWeekIndex, activeDayIndex, textBlock, textIndex))
                  .join("")
              : `<p class="editor-empty-hint">Для этого дня пока нет текстовых блоков.</p>`
          }
        </div>
      </section>
    `;
  }

  function renderWorkspace() {
    const hasWeeks = state.structure.weeks.length > 0;
    emptyStateContainer.hidden = hasWeeks;
    weekEditorContainer.hidden = !hasWeeks;
    dayEditorContainer.hidden = !hasWeeks;
    renderWeekEditor();
    renderDayEditor();
  }

  function clearDropTargets() {
    document.querySelectorAll(".is-drop-target").forEach((element) => {
      element.classList.remove("is-drop-target");
    });
  }

  function currentDayListPath(weekIndex) {
    return `structure.weeks.${weekIndex}.days`;
  }

  function renderAll() {
    syncActiveIndexes();
    renderOrmEditor();
    renderSidebar();
    renderWorkspace();
    serializeState();
    renderStatusActions();
  }

  function rerenderAndMarkDirty(message) {
    renderAll();
    markDirty(message);
  }

  function handleAction(button) {
    const action = button.dataset.action;

    if (action === "restore-draft") {
      const draft = readDraft();
      if (!draft) {
        renderStatus("Локальный черновик не найден.", "warning");
        renderStatusActions();
        return;
      }
      state.one_rep_max_config = deepClone(draft.one_rep_max_config);
      state.structure = deepClone(draft.structure);
      if (draft.fields) {
        restoreMetaFields(draft.fields);
      }
      if (draft.ui) {
        activeWeekIndex = Number(draft.ui.activeWeekIndex || 0);
        Object.keys(draft.ui.activeDayIndexes || {}).forEach((key) => {
          activeDayIndexes[key] = draft.ui.activeDayIndexes[key];
        });
      }
      renderAll();
      markDirty("Черновик восстановлен.");
      return;
    }

    if (action === "discard-draft") {
      removeDraft();
      renderStatus("Локальный черновик удален.", null);
      renderStatusActions();
      return;
    }

    if (action === "add-orm") {
      state.one_rep_max_config.push(createDefaultOrm());
      rerenderAndMarkDirty("Элемент 1ПМ добавлен.");
      return;
    }

    if (action === "remove-orm") {
      state.one_rep_max_config.splice(Number(button.dataset.index), 1);
      rerenderAndMarkDirty("Элемент 1ПМ удален.");
      return;
    }

    if (action === "add-week") {
      state.structure.weeks.push(createDefaultWeek());
      activeWeekIndex = state.structure.weeks.length - 1;
      rerenderAndMarkDirty("Неделя добавлена.");
      return;
    }

    if (action === "select-week") {
      activeWeekIndex = Number(button.dataset.index);
      renderAll();
      return;
    }

    if (action === "remove-week") {
      state.structure.weeks.splice(Number(button.dataset.index), 1);
      rerenderAndMarkDirty("Неделя удалена.");
      return;
    }

    if (action === "add-day") {
      const weekIndex = Number(button.dataset.weekIndex);
      const week = state.structure.weeks[weekIndex];
      const weekday = nextWeekdayValue(week, null);
      if (!weekday) {
        renderStatus("В неделе уже использованы все дни недели.", "warning");
        return;
      }
      const day = createDefaultDay(week);
      day.weekday = weekday;
      week.days.push(day);
      activeWeekIndex = weekIndex;
      activeDayIndexes[weekIndex] = week.days.length - 1;
      rerenderAndMarkDirty("День добавлен.");
      return;
    }

    if (action === "select-day") {
      activeWeekIndex = Number(button.dataset.weekIndex);
      activeDayIndexes[activeWeekIndex] = Number(button.dataset.index);
      renderAll();
      return;
    }

    if (action === "remove-day") {
      const weekIndex = Number(button.dataset.weekIndex);
      const dayIndex = Number(button.dataset.dayIndex);
      state.structure.weeks[weekIndex].days.splice(dayIndex, 1);
      rerenderAndMarkDirty("День удален.");
      return;
    }

    if (action === "add-exercise") {
      const weekIndex = Number(button.dataset.weekIndex);
      const dayIndex = Number(button.dataset.dayIndex);
      state.structure.weeks[weekIndex].days[dayIndex].exercises.push(createDefaultExercise());
      rerenderAndMarkDirty("Упражнение добавлено.");
      return;
    }

    if (action === "remove-exercise") {
      const weekIndex = Number(button.dataset.weekIndex);
      const dayIndex = Number(button.dataset.dayIndex);
      state.structure.weeks[weekIndex].days[dayIndex].exercises.splice(Number(button.dataset.exerciseIndex), 1);
      rerenderAndMarkDirty("Упражнение удалено.");
      return;
    }

    if (action === "add-set") {
      const weekIndex = Number(button.dataset.weekIndex);
      const dayIndex = Number(button.dataset.dayIndex);
      const exerciseIndex = Number(button.dataset.exerciseIndex);
      state.structure.weeks[weekIndex].days[dayIndex].exercises[exerciseIndex].sets.push(createDefaultSet());
      rerenderAndMarkDirty("Подход добавлен.");
      return;
    }

    if (action === "remove-set") {
      const weekIndex = Number(button.dataset.weekIndex);
      const dayIndex = Number(button.dataset.dayIndex);
      const exerciseIndex = Number(button.dataset.exerciseIndex);
      state.structure.weeks[weekIndex].days[dayIndex].exercises[exerciseIndex].sets.splice(Number(button.dataset.setIndex), 1);
      rerenderAndMarkDirty("Подход удален.");
      return;
    }

    if (action === "add-text-block") {
      const weekIndex = Number(button.dataset.weekIndex);
      const dayIndex = Number(button.dataset.dayIndex);
      state.structure.weeks[weekIndex].days[dayIndex].text_blocks.push(createDefaultTextBlock());
      rerenderAndMarkDirty("Текстовый блок добавлен.");
      return;
    }

    if (action === "remove-text-block") {
      const weekIndex = Number(button.dataset.weekIndex);
      const dayIndex = Number(button.dataset.dayIndex);
      state.structure.weeks[weekIndex].days[dayIndex].text_blocks.splice(Number(button.dataset.textIndex), 1);
      rerenderAndMarkDirty("Текстовый блок удален.");
    }
  }

  function collectDragState(node) {
    const kind = node.dataset.dragKind;
    if (!kind) {
      return null;
    }

    if (kind === "week") {
      return { kind, weekIndex: Number(node.dataset.weekIndex) };
    }
    if (kind === "day") {
      return {
        kind,
        weekIndex: Number(node.dataset.weekIndex),
        dayIndex: Number(node.dataset.dayIndex),
      };
    }
    if (kind === "orm") {
      return { kind, index: Number(node.dataset.index) };
    }
    if (kind === "exercise") {
      return {
        kind,
        weekIndex: Number(node.dataset.weekIndex),
        dayIndex: Number(node.dataset.dayIndex),
        exerciseIndex: Number(node.dataset.exerciseIndex),
      };
    }
    if (kind === "set") {
      return {
        kind,
        weekIndex: Number(node.dataset.weekIndex),
        dayIndex: Number(node.dataset.dayIndex),
        exerciseIndex: Number(node.dataset.exerciseIndex),
        setIndex: Number(node.dataset.setIndex),
      };
    }
    if (kind === "text-block") {
      return {
        kind,
        weekIndex: Number(node.dataset.weekIndex),
        dayIndex: Number(node.dataset.dayIndex),
        textIndex: Number(node.dataset.textIndex),
      };
    }
    return null;
  }

  function isCompatibleDrop(target) {
    if (!dragState) {
      return false;
    }
    const dropKind = target.dataset.dropKind;
    if (dropKind !== dragState.kind) {
      return false;
    }
    if (dropKind === "day") {
      return Number(target.dataset.weekIndex) === dragState.weekIndex;
    }
    if (dropKind === "exercise") {
      return (
        Number(target.dataset.weekIndex) === dragState.weekIndex &&
        Number(target.dataset.dayIndex) === dragState.dayIndex
      );
    }
    if (dropKind === "set") {
      return (
        Number(target.dataset.weekIndex) === dragState.weekIndex &&
        Number(target.dataset.dayIndex) === dragState.dayIndex &&
        Number(target.dataset.exerciseIndex) === dragState.exerciseIndex
      );
    }
    if (dropKind === "text-block") {
      return (
        Number(target.dataset.weekIndex) === dragState.weekIndex &&
        Number(target.dataset.dayIndex) === dragState.dayIndex
      );
    }
    return true;
  }

  function performDrop(target) {
    if (!dragState || !isCompatibleDrop(target)) {
      return false;
    }

    if (dragState.kind === "week") {
      const targetIndex = Number(target.dataset.weekIndex);
      moveListItem(state.structure.weeks, dragState.weekIndex, targetIndex);
      activeWeekIndex = targetIndex;
      return true;
    }

    if (dragState.kind === "day") {
      const weekIndex = dragState.weekIndex;
      const list = state.structure.weeks[weekIndex].days;
      const targetIndex = Number(target.dataset.dayIndex);
      moveListItem(list, dragState.dayIndex, targetIndex);
      activeWeekIndex = weekIndex;
      activeDayIndexes[weekIndex] = targetIndex;
      return true;
    }

    if (dragState.kind === "orm") {
      moveListItem(state.one_rep_max_config, dragState.index, Number(target.dataset.index));
      return true;
    }

    if (dragState.kind === "exercise") {
      const list = state.structure.weeks[dragState.weekIndex].days[dragState.dayIndex].exercises;
      moveListItem(list, dragState.exerciseIndex, Number(target.dataset.exerciseIndex));
      return true;
    }

    if (dragState.kind === "set") {
      const list = state.structure.weeks[dragState.weekIndex]
        .days[dragState.dayIndex]
        .exercises[dragState.exerciseIndex]
        .sets;
      moveListItem(list, dragState.setIndex, Number(target.dataset.setIndex));
      return true;
    }

    if (dragState.kind === "text-block") {
      const list = state.structure.weeks[dragState.weekIndex].days[dragState.dayIndex].text_blocks;
      moveListItem(list, dragState.textIndex, Number(target.dataset.textIndex));
      return true;
    }

    return false;
  }

  form.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) {
      return;
    }
    event.preventDefault();
    handleAction(button);
  });

  form.addEventListener("input", (event) => {
    const target = event.target;
    if (target.dataset.path && target.dataset.field) {
      setObjectValue(target.dataset.path, target.dataset.field, target);
      serializeState();
      if (target.dataset.rerender === "true") {
        renderAll();
      }
      markDirty();
      return;
    }

    if (target.name && metaFieldNames.includes(target.name)) {
      markDirty();
    }
  });

  form.addEventListener("change", (event) => {
    const target = event.target;
    if (target.dataset.path && target.dataset.field) {
      setObjectValue(target.dataset.path, target.dataset.field, target);
      if (target.dataset.rerender === "true") {
        renderAll();
      } else {
        serializeState();
      }
      markDirty();
      return;
    }

    if (target.name && metaFieldNames.includes(target.name)) {
      markDirty();
    }
  });

  form.addEventListener("dragstart", (event) => {
    const item = event.target.closest("[data-drag-kind]");
    if (!item) {
      return;
    }
    dragState = collectDragState(item);
    if (!dragState || !event.dataTransfer) {
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", JSON.stringify(dragState));
  });

  form.addEventListener("dragover", (event) => {
    const target = event.target.closest("[data-drop-kind]");
    if (!target || !isCompatibleDrop(target)) {
      return;
    }
    event.preventDefault();
    target.classList.add("is-drop-target");
  });

  form.addEventListener("dragleave", (event) => {
    const target = event.target.closest("[data-drop-kind]");
    if (!target) {
      return;
    }
    target.classList.remove("is-drop-target");
  });

  form.addEventListener("drop", (event) => {
    const target = event.target.closest("[data-drop-kind]");
    if (!target || !isCompatibleDrop(target)) {
      clearDropTargets();
      dragState = null;
      return;
    }
    event.preventDefault();
    const moved = performDrop(target);
    clearDropTargets();
    dragState = null;
    if (moved) {
      rerenderAndMarkDirty("Порядок обновлен.");
    }
  });

  form.addEventListener("dragend", () => {
    clearDropTargets();
    dragState = null;
  });

  form.addEventListener("submit", () => {
    isSubmitting = true;
    serializeState();
    writeDraft();
    renderStatus("Изменения отправляются на сервер.", "dirty");
  });

  window.addEventListener("beforeunload", (event) => {
    if (!isDirty || isSubmitting) {
      return;
    }
    event.preventDefault();
    event.returnValue = "";
  });

  renderAll();
  renderStatus("Изменения сохраняются после отправки формы.", null);
  renderStatusActions();
})();
