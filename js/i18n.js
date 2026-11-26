// Языки интерфейса: русский, английский, немецкий, сербский (латиница), испанский.
// Выбор хранится на этом устройстве ("lang"); без выбора — язык системы, если он из списка, иначе английский.
// Названия категорий и магазинов — данные из таблицы, их не переводим.
// Подключается первым: t() нужна всем остальным файлам.

var LANGS = [["ru", "Русский"], ["en", "English"], ["de", "Deutsch"], ["sr", "Srpski"], ["es", "Español"]];
// локаль для дат и чисел: en-GB — «25 Nov», день перед месяцем, как привычно в Европе
var LOCALES = { ru: "ru-RU", en: "en-GB", de: "de-DE", sr: "sr-Latn-RS", es: "es-ES" };

function langChoice() { var v = null; try { v = localStorage.getItem("lang"); } catch (e) {} return LOCALES[v] ? v : "auto"; }
function systemLang() {
  var list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""]);
  for (var i = 0; i < list.length; i++) {
    var code = String(list[i] || "").toLowerCase().split(/[-_]/)[0];
    if (LOCALES[code]) return code;
  }
  return "en";
}
var LANG = langChoice() === "auto" ? systemLang() : langChoice();
function locale() { return LOCALES[LANG]; }

// Тексты. {имя} — подстановка; для чисел с формами (1 операция / 2 операции / 5 операций) — объект с формами
// по правилам языка: one / few / many / other (русский: one, few, many; сербский: one, few, other; остальные: one, other).
var I18N = {
  "app.title": { ru: "Бюджет", en: "Budget", de: "Budget", sr: "Budžet", es: "Presupuesto" },
  "retry": { ru: "Повторить", en: "Retry", de: "Wiederholen", sr: "Ponovi", es: "Reintentar" },
  "save": { ru: "Сохранить", en: "Save", de: "Speichern", sr: "Sačuvaj", es: "Guardar" },
  "delete": { ru: "Удалить", en: "Delete", de: "Löschen", sr: "Obriši", es: "Eliminar" },
  "back": { ru: "Назад", en: "Back", de: "Zurück", sr: "Nazad", es: "Atrás" },
  "back.toForm": { ru: "Назад к вводу", en: "Back to entry", de: "Zurück zur Eingabe", sr: "Nazad na unos", es: "Volver a la entrada" },

  "net.title": { ru: "Нет связи", en: "No connection", de: "Keine Verbindung", sr: "Nema veze", es: "Sin conexión" },
  "net.savedOnPhone": { ru: "Операции сохранятся на телефоне", en: "Transactions will be kept on the phone", de: "Buchungen bleiben auf dem Telefon", sr: "Transakcije ostaju na telefonu", es: "Los movimientos se guardan en el teléfono" },
  "net.pending": {
    ru: { one: "{n} операция ждёт отправки", few: "{n} операции ждут отправки", many: "{n} операций ждут отправки" },
    en: { one: "{n} transaction waiting to be sent", other: "{n} transactions waiting to be sent" },
    de: { one: "{n} Buchung wartet auf Versand", other: "{n} Buchungen warten auf Versand" },
    sr: { one: "{n} transakcija čeka slanje", few: "{n} transakcije čekaju slanje", other: "{n} transakcija čeka slanje" },
    es: { one: "{n} movimiento pendiente de envío", other: "{n} movimientos pendientes de envío" } },

  "hist.title": { ru: "История", en: "History", de: "Verlauf", sr: "Istorija", es: "Historial" },
  "settings.title": { ru: "Настройки", en: "Settings", de: "Einstellungen", sr: "Podešavanja", es: "Ajustes" },
  "edit.title": { ru: "Изменение", en: "Edit", de: "Bearbeiten", sr: "Izmena", es: "Editar" },
  "edit.whenAria": { ru: "Дата и время операции", en: "Transaction date and time", de: "Datum und Uhrzeit der Buchung", sr: "Datum i vreme transakcije", es: "Fecha y hora del movimiento" },

  "form.signAria": { ru: "Сменить знак", en: "Change sign", de: "Vorzeichen ändern", sr: "Promeni znak", es: "Cambiar signo" },
  "form.clearAria": { ru: "Стереть сумму", en: "Clear amount", de: "Betrag löschen", sr: "Obriši iznos", es: "Borrar importe" },
  "form.curAria": { ru: "Валюта", en: "Currency", de: "Währung", sr: "Valuta", es: "Moneda" },
  "form.curPanelAria": { ru: "Выбор валюты", en: "Choose currency", de: "Währung wählen", sr: "Izbor valute", es: "Elegir moneda" },
  "form.themeAria": { ru: "Тёмная тема", en: "Dark theme", de: "Dunkles Design", sr: "Tamna tema", es: "Tema oscuro" },
  "form.enterAmount": { ru: "Введите сумму", en: "Enter an amount", de: "Betrag eingeben", sr: "Unesite iznos", es: "Introduce un importe" },
  "form.pickCategory": { ru: "Выберите категорию", en: "Choose a category", de: "Kategorie wählen", sr: "Izaberite kategoriju", es: "Elige una categoría" },
  "form.saved": { ru: "Сохранено: {amount} · {cat}", en: "Saved: {amount} · {cat}", de: "Gespeichert: {amount} · {cat}", sr: "Sačuvano: {amount} · {cat}", es: "Guardado: {amount} · {cat}" },
  "form.savedOffline": { ru: "Нет связи — сохранено на телефоне, отправится позже", en: "No connection — saved on the phone, will be sent later", de: "Keine Verbindung — auf dem Telefon gespeichert, wird später gesendet", sr: "Nema veze — sačuvano na telefonu, biće poslato kasnije", es: "Sin conexión — guardado en el teléfono, se enviará más tarde" },
  "form.pasteNoAmount": { ru: "В тексте нет суммы с валютой — введите вручную", en: "No amount with a currency in the text — enter it manually", de: "Kein Betrag mit Währung im Text — bitte manuell eingeben", sr: "U tekstu nema iznosa sa valutom — unesite ručno", es: "No hay un importe con moneda en el texto — introdúcelo a mano" },
  "form.smsFail": { ru: "Не получилось разобрать сообщение банка — введите сумму вручную", en: "Couldn't read the bank message — enter the amount manually", de: "Bankmitteilung nicht erkannt — Betrag bitte manuell eingeben", sr: "Poruka banke nije prepoznata — unesite iznos ručno", es: "No se pudo leer el mensaje del banco — introduce el importe a mano" },
  "form.loadWhenOnline": { ru: "Загрузится, когда будет связь", en: "Will load when you're online", de: "Wird geladen, sobald eine Verbindung besteht", sr: "Učitaće se kada bude veze", es: "Se cargará cuando haya conexión" },
  "form.dictLoading": { ru: "Справочники ещё загружаются — попробуйте через пару секунд", en: "Lists are still loading — try again in a few seconds", de: "Listen werden noch geladen — in ein paar Sekunden erneut versuchen", sr: "Liste se još učitavaju — pokušajte za par sekundi", es: "Las listas aún se están cargando — inténtalo en unos segundos" },
  "form.noNetEdit": { ru: "Нет связи — изменить можно, когда появится связь", en: "No connection — you can edit once you're back online", de: "Keine Verbindung — Bearbeiten ist möglich, sobald eine Verbindung besteht", sr: "Nema veze — izmena je moguća kada se veza vrati", es: "Sin conexión — podrás editar cuando vuelva la conexión" },
  "form.noNetDelete": { ru: "Нет связи — удалить можно, когда появится связь", en: "No connection — you can delete once you're back online", de: "Keine Verbindung — Löschen ist möglich, sobald eine Verbindung besteht", sr: "Nema veze — brisanje je moguće kada se veza vrati", es: "Sin conexión — podrás eliminar cuando vuelva la conexión" },
  "form.noNetEditLost": { ru: "Связь пропала — изменение не сохранилось", en: "Connection lost — the change wasn't saved", de: "Verbindung verloren — Änderung nicht gespeichert", sr: "Veza je prekinuta — izmena nije sačuvana", es: "Se perdió la conexión — el cambio no se guardó" },
  "form.editFailed": { ru: "Изменение не сохранилось: {msg}", en: "The change wasn't saved: {msg}", de: "Änderung nicht gespeichert: {msg}", sr: "Izmena nije sačuvana: {msg}", es: "El cambio no se guardó: {msg}" },

  "nav.history": { ru: "История", en: "History", de: "Verlauf", sr: "Istorija", es: "Historial" },
  "seg.ops": { ru: "Операции", en: "Transactions", de: "Buchungen", sr: "Transakcije", es: "Movimientos" },
  "seg.stats": { ru: "Статистика", en: "Statistics", de: "Statistik", sr: "Statistika", es: "Estadísticas" },

  "hist.today": { ru: "Сегодня", en: "Today", de: "Heute", sr: "Danas", es: "Hoy" },
  "hist.yesterday": { ru: "Вчера", en: "Yesterday", de: "Gestern", sr: "Juče", es: "Ayer" },
  "hist.noDate": { ru: "Без даты", en: "No date", de: "Ohne Datum", sr: "Bez datuma", es: "Sin fecha" },
  "hist.noCategory": { ru: "Без категории", en: "No category", de: "Ohne Kategorie", sr: "Bez kategorije", es: "Sin categoría" },
  "hist.empty": { ru: "Пока пусто", en: "Nothing here yet", de: "Noch keine Einträge", sr: "Još ništa nema", es: "Aún no hay nada" },
  "hist.waiting": { ru: "Ждут отправки", en: "Waiting to be sent", de: "Warten auf Versand", sr: "Čekaju slanje", es: "Pendientes de envío" },
  "hist.olderFailed": { ru: "Старые операции не загрузились", en: "Older transactions didn't load", de: "Ältere Buchungen nicht geladen", sr: "Starije transakcije se nisu učitale", es: "No se cargaron los movimientos anteriores" },
  "hist.allLoaded": { ru: "Это все операции", en: "That's all transactions", de: "Das sind alle Buchungen", sr: "To su sve transakcije", es: "No hay más movimientos" },
  "hist.olderWaitNet": { ru: "Старые операции загрузятся, когда будет связь", en: "Older transactions will load when you're online", de: "Ältere Buchungen werden geladen, sobald eine Verbindung besteht", sr: "Starije transakcije će se učitati kada bude veze", es: "Los movimientos anteriores se cargarán cuando haya conexión" },
  "hist.deleted": { ru: "Удалено: {amount}", en: "Deleted: {amount}", de: "Gelöscht: {amount}", sr: "Obrisano: {amount}", es: "Eliminado: {amount}" },
  // подписи под операциями в истории (со строчной буквы) и уведомления по нажатию на трату из очереди
  "st.sending": { ru: "отправляется…", en: "sending…", de: "wird gesendet…", sr: "šalje se…", es: "enviando…" },
  "st.queued": { ru: "в очереди на отправку", en: "queued for sending", de: "in der Warteschlange", sr: "u redu za slanje", es: "en cola de envío" },
  "st.waitNet": { ru: "ждёт связи", en: "waiting for connection", de: "wartet auf Verbindung", sr: "čeka vezu", es: "esperando conexión" },
  "st.saving": { ru: "сохраняется…", en: "saving…", de: "wird gespeichert…", sr: "čuva se…", es: "guardando…" },
  "st.failed": { ru: "не записалась: {msg}", en: "not saved: {msg}", de: "nicht gespeichert: {msg}", sr: "nije upisana: {msg}", es: "no se guardó: {msg}" },
  "q.sending": { ru: "Отправляется…", en: "Sending…", de: "Wird gesendet…", sr: "Šalje se…", es: "Enviando…" },
  "q.queued": { ru: "В очереди на отправку", en: "Queued for sending", de: "In der Warteschlange", sr: "U redu za slanje", es: "En cola de envío" },
  "q.waitNet": { ru: "Отправится, когда будет связь", en: "Will be sent when you're online", de: "Wird gesendet, sobald eine Verbindung besteht", sr: "Biće poslato kada bude veze", es: "Se enviará cuando haya conexión" },
  "q.sent": {
    ru: { one: "Отправлено с телефона: {n} операция", few: "Отправлено с телефона: {n} операции", many: "Отправлено с телефона: {n} операций" },
    en: { one: "Sent from the phone: {n} transaction", other: "Sent from the phone: {n} transactions" },
    de: { one: "Vom Telefon gesendet: {n} Buchung", other: "Vom Telefon gesendet: {n} Buchungen" },
    sr: { one: "Poslato sa telefona: {n} transakcija", few: "Poslato sa telefona: {n} transakcije", other: "Poslato sa telefona: {n} transakcija" },
    es: { one: "Enviado desde el teléfono: {n} movimiento", other: "Enviados desde el teléfono: {n} movimientos" } },
  "q.addFailedOne": { ru: "Операция не записалась: {msg}", en: "The transaction wasn't saved: {msg}", de: "Buchung nicht gespeichert: {msg}", sr: "Transakcija nije upisana: {msg}", es: "El movimiento no se guardó: {msg}" },
  "q.addFailedMany": { ru: "Не записались операции: {n} — {msg}", en: "{n} transactions weren't saved — {msg}", de: "{n} Buchungen nicht gespeichert — {msg}", sr: "Nije upisano transakcija: {n} — {msg}", es: "No se guardaron {n} movimientos — {msg}" },
  "q.sendFailed": { ru: "Не отправилось: {msg}. Операции остались на телефоне", en: "Not sent: {msg}. The transactions are still on the phone", de: "Nicht gesendet: {msg}. Die Buchungen bleiben auf dem Telefon", sr: "Nije poslato: {msg}. Transakcije su ostale na telefonu", es: "No se envió: {msg}. Los movimientos siguen en el teléfono" },
  "q.cancelFailed": { ru: "Не удалось удалить на сервере: {msg}", en: "Couldn't delete on the server: {msg}", de: "Löschen auf dem Server fehlgeschlagen: {msg}", sr: "Brisanje na serveru nije uspelo: {msg}", es: "No se pudo eliminar en el servidor: {msg}" },

  // статистика; кнопки вида промежутка — короткие: на iPhone mini их четыре в одной строке
  "kind.p": { ru: "С {n}-го", en: "From {nth}", de: "Ab {n}.", sr: "Od {n}.", es: "Desde {n}" },
  "kind.m": { ru: "Месяц", en: "Month", de: "Monat", sr: "Mesec", es: "Mes" },
  "kind.y": { ru: "Год", en: "Year", de: "Jahr", sr: "Godina", es: "Año" },
  "kind.c": { ru: "Даты", en: "Dates", de: "Zeitraum", sr: "Datumi", es: "Fechas" },
  "stats.prevAria": { ru: "Раньше", en: "Earlier", de: "Früher", sr: "Ranije", es: "Anterior" },
  "stats.nextAria": { ru: "Позже", en: "Later", de: "Später", sr: "Kasnije", es: "Siguiente" },
  "stats.from": { ru: "С", en: "From", de: "Von", sr: "Od", es: "Desde" },
  "stats.to": { ru: "По", en: "To", de: "Bis", sr: "Do", es: "Hasta" },
  "stats.datesInvalid": { ru: "Выберите даты: «С» не позже «По»", en: "Choose dates: “From” no later than “To”", de: "Zeitraum wählen: „Von“ nicht nach „Bis“", sr: "Izaberite datume: „Od“ ne posle „Do“", es: "Elige fechas: «Desde» no posterior a «Hasta»" },
  "stats.waitNet": { ru: "Статистика загрузится, когда будет связь", en: "Statistics will load when you're online", de: "Statistik wird geladen, sobald eine Verbindung besteht", sr: "Statistika će se učitati kada bude veze", es: "Las estadísticas se cargarán cuando haya conexión" },
  "stats.loadFailed": { ru: "Не загрузилось: {msg}", en: "Didn't load: {msg}", de: "Nicht geladen: {msg}", sr: "Nije učitano: {msg}", es: "No se cargó: {msg}" },
  "stats.spent": { ru: "Траты", en: "Spending", de: "Ausgaben", sr: "Troškovi", es: "Gastos" },
  "stats.income": { ru: "Начисления", en: "Income", de: "Einnahmen", sr: "Prihodi", es: "Ingresos" },
  "stats.balance": { ru: "Баланс", en: "Balance", de: "Saldo", sr: "Saldo", es: "Saldo" },
  "stats.noOps": { ru: "Операций за этот промежуток нет", en: "No transactions in this period", de: "Keine Buchungen in diesem Zeitraum", sr: "Nema transakcija u ovom periodu", es: "No hay movimientos en este periodo" },
  "stats.spentByCat": { ru: "Траты по категориям", en: "Spending by category", de: "Ausgaben nach Kategorie", sr: "Troškovi po kategorijama", es: "Gastos por categoría" },

  "set.lang": { ru: "Язык", en: "Language", de: "Sprache", sr: "Jezik", es: "Idioma" },
  "set.langAuto": { ru: "Как в системе", en: "System", de: "System", sr: "Kao sistem", es: "Sistema" },
  "set.about": { ru: "О форме", en: "About", de: "Info", sr: "O aplikaciji", es: "Información" },
  "set.pageVer": { ru: "Версия страницы", en: "Page version", de: "Seitenversion", sr: "Verzija stranice", es: "Versión de la página" },
  "set.serverVer": { ru: "Версия сервера", en: "Server version", de: "Serverversion", sr: "Verzija servera", es: "Versión del servidor" },
  "set.diag": { ru: "Диагностика экрана", en: "Screen diagnostics", de: "Bildschirmdiagnose", sr: "Dijagnostika ekrana", es: "Diagnóstico de pantalla" },

  "diag.versions": { ru: "Версии: страница {p}, сервер {s}", en: "Versions: page {p}, server {s}", de: "Versionen: Seite {p}, Server {s}", sr: "Verzije: stranica {p}, server {s}", es: "Versiones: página {p}, servidor {s}" },
  "diag.sizes": { ru: "Размеры окна (для настройки формы)", en: "Window sizes (for tuning the form)", de: "Fenstergrößen (zur Anpassung des Formulars)", sr: "Veličine prozora (za podešavanje forme)", es: "Tamaños de ventana (para ajustar el formulario)" },
  "diag.bottom": { ru: "низ «Истории» {b} · запас под панель {r} · кнопки {h}", en: "“History” bottom {b} · bar reserve {r} · buttons {h}", de: "Unterkante „Verlauf“ {b} · Reserve für Leiste {r} · Schaltflächen {h}", sr: "dno „Istorije“ {b} · rezerva za traku {r} · dugmad {h}", es: "parte inferior de «Historial» {b} · reserva para la barra {r} · botones {h}" },
  "diag.compact": { ru: "компакт", en: "compact", de: "kompakt", sr: "kompaktno", es: "compacto" },
  "diag.fit": { ru: "подгонка {h} запас {l} под панель {r}", en: "fit {h} spare {l} bar reserve {r}", de: "Anpassung {h} Rest {l} Leiste {r}", sr: "podešavanje {h} višak {l} traka {r}", es: "ajuste {h} margen {l} barra {r}" },
  "diag.end": { ru: "конец", en: "end", de: "Ende", sr: "kraj", es: "fin" },
  "diag.log": { ru: "Журнал с момента открытия:", en: "Log since opening:", de: "Protokoll seit dem Öffnen:", sr: "Dnevnik od otvaranja:", es: "Registro desde la apertura:" },
  "diag.close": { ru: "Нажмите, чтобы закрыть", en: "Tap to close", de: "Zum Schließen tippen", sr: "Dodirnite za zatvaranje", es: "Toca para cerrar" },

  // ошибки связи и сервера; err.<код> — по коду, который присылает сервер (code в ответе)
  "err.openViaShortcut": { ru: "Откройте форму через шорткат «Бюджет»", en: "Open the form with the «Бюджет» shortcut", de: "Formular über den Kurzbefehl «Бюджет» öffnen", sr: "Otvorite formu prečicom «Бюджет»", es: "Abre el formulario con el atajo «Бюджет»" },
  "err.noAccess": { ru: "Нет доступа. Откройте форму через шорткат «Бюджет»", en: "No access. Open the form with the «Бюджет» shortcut", de: "Kein Zugriff. Formular über den Kurzbefehl «Бюджет» öffnen", sr: "Nema pristupa. Otvorite formu prečicom «Бюджет»", es: "Sin acceso. Abre el formulario con el atajo «Бюджет»" },
  "err.server": { ru: "Ошибка сервера", en: "Server error", de: "Serverfehler", sr: "Greška servera", es: "Error del servidor" },
  "err.httpPage": { ru: "Сервер ответил ошибкой{http} — попробуйте позже", en: "The server returned an error{http} — try again later", de: "Der Server hat einen Fehler gemeldet{http} — später erneut versuchen", sr: "Server je vratio grešku{http} — pokušajte kasnije", es: "El servidor devolvió un error{http} — inténtalo más tarde" },
  "err.timeout": { ru: "Сервер не ответил — попробуйте ещё раз", en: "The server didn't respond — try again", de: "Der Server antwortet nicht — erneut versuchen", sr: "Server ne odgovara — pokušajte ponovo", es: "El servidor no respondió — inténtalo de nuevo" },
  "err.network": { ru: "Нет связи с сервером", en: "Can't reach the server", de: "Keine Verbindung zum Server", sr: "Nema veze sa serverom", es: "Sin conexión con el servidor" },
  "err.not_found": { ru: "Операция не найдена или изменилась — обновите список", en: "Transaction not found or changed — refresh the list", de: "Buchung nicht gefunden oder geändert — Liste aktualisieren", sr: "Transakcija nije pronađena ili je izmenjena — osvežite listu", es: "Movimiento no encontrado o modificado — actualiza la lista" },
  "err.bad_amount": { ru: "Некорректная сумма", en: "Invalid amount", de: "Ungültiger Betrag", sr: "Neispravan iznos", es: "Importe no válido" },
  "err.unknown_currency": { ru: "Неизвестная валюта", en: "Unknown currency", de: "Unbekannte Währung", sr: "Nepoznata valuta", es: "Moneda desconocida" },
  "err.unknown_category": { ru: "Неизвестная категория", en: "Unknown category", de: "Unbekannte Kategorie", sr: "Nepoznata kategorija", es: "Categoría desconocida" },
  "err.busy": { ru: "Сервер занят — попробуйте ещё раз через минуту", en: "The server is busy — try again in a minute", de: "Server ausgelastet — in einer Minute erneut versuchen", sr: "Server je zauzet — pokušajte ponovo za minut", es: "El servidor está ocupado — inténtalo de nuevo en un minuto" },
  "err.server_failed": { ru: "Сервер не смог выполнить запрос — попробуйте ещё раз", en: "The server couldn't complete the request — try again", de: "Der Server konnte die Anfrage nicht ausführen — erneut versuchen", sr: "Server nije mogao da izvrši zahtev — pokušajte ponovo", es: "El servidor no pudo completar la solicitud — inténtalo de nuevo" },
  "err.bad_date": { ru: "Некорректная дата", en: "Invalid date", de: "Ungültiges Datum", sr: "Neispravan datum", es: "Fecha no válida" },
  "err.future_date": { ru: "Дата операции в будущем", en: "The date is in the future", de: "Das Datum liegt in der Zukunft", sr: "Datum je u budućnosti", es: "La fecha está en el futuro" },
  "err.no_rates": { ru: "Нет курсов валют — попробуйте позже", en: "No exchange rates — try again later", de: "Keine Wechselkurse — später erneut versuchen", sr: "Nema kurseva valuta — pokušajte kasnije", es: "No hay tipos de cambio — inténtalo más tarde" },
  "err.bad_request": { ru: "Некорректный запрос", en: "Invalid request", de: "Ungültige Anfrage", sr: "Neispravan zahtev", es: "Solicitud no válida" }
};

// перевод по ключу; params — подстановки {имя}
function t(key, params) {
  var e = I18N[key];
  var s = e ? (e[LANG] != null ? e[LANG] : e.en != null ? e.en : e.ru) : key;
  if (params) s = String(s).replace(/\{(\w+)\}/g, function (m, k) { return params[k] != null ? params[k] : m; });
  return s;
}
// с числом: форма слова по правилам языка (1 операция, 3 операции, 5 операций)
function tn(key, n, params) {
  var e = I18N[key], forms = e && (e[LANG] || e.en);
  var cat = "other";
  try { cat = new Intl.PluralRules(locale()).select(n); } catch (x) {}
  var s = forms ? (forms[cat] || forms.other || forms.many || forms.one) : key;
  var p = Object.assign({ n: n }, params || {});
  return s.replace(/\{(\w+)\}/g, function (m, k) { return p[k] != null ? p[k] : m; });
}
// английский порядковый: 1st, 2nd, 3rd, 20th
function ordinalEn(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

// текст ошибки от сервера на языке страницы: по коду, иначе как прислал сервер
function serverError(res) {
  if (!res) return "";
  if (res.code && I18N["err." + res.code]) return t("err." + res.code);
  return res.error || "";
}

// ---------- даты и числа по правилам языка ----------
function fmtParts(d, opts) {
  // без хвостовых «г.» и точек после года: «19 дек. 2026», а не «19 дек. 2026 г.»
  var parts;
  try { parts = new Intl.DateTimeFormat(locale(), opts).formatToParts(d); } catch (x) { return d.toLocaleDateString(); }
  var last = -1;
  parts.forEach(function (p, i) { if (p.type !== "literal") last = i; });
  return parts.slice(0, last + 1).map(function (p) { return p.value; }).join("");
}
function cap1(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }
// «25 нояб.» / «25 Nov» / «25. Nov.»; withYear — с годом
function fmtDayMonth(d, withYear) { return fmtParts(d, withYear ? { day: "numeric", month: "short", year: "numeric" } : { day: "numeric", month: "short" }); }
// «25 ноября» / «25 November»
function fmtDayMonthLong(d, withYear) { return fmtParts(d, withYear ? { day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "long" }); }
// «Ноябрь 2026» / «November 2026»
function fmtMonthYear(d) { return cap1(fmtParts(d, { month: "long", year: "numeric" })); }
function fmtWeekday(d) { return cap1(fmtParts(d, { weekday: "long" })); }
function fmtNum(n) { return isFinite(n) ? Number(n).toLocaleString(locale(), { maximumFractionDigits: 2 }) : String(n); }

// ---------- статичный текст страницы: data-i18n — текст, data-i18n-aria — подпись для экранного диктора ----------
function applyStaticI18n() {
  document.documentElement.setAttribute("lang", LANG === "sr" ? "sr-Latn" : LANG);
  document.title = t("app.title");
  [].forEach.call(document.querySelectorAll("[data-i18n]"), function (n) { n.textContent = t(n.getAttribute("data-i18n")); });
  [].forEach.call(document.querySelectorAll("[data-i18n-aria]"), function (n) { n.setAttribute("aria-label", t(n.getAttribute("data-i18n-aria"))); });
}
