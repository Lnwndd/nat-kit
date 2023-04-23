import { chat_metadata, saveSettingsDebounced } from "../../../script.js";
import { extension_settings, getContext } from "../../extensions.js";
import { debounce } from "../../utils.js";
export { MODULE_NAME };

const saveChatDebounced = debounce(async () => await getContext().saveChat(), 1000);

const MODULE_NAME = '2_floating_prompt'; // <= Deliberate, for sorting lower than memory
const UPDATE_INTERVAL = 1000;

const DEFAULT_DEPTH = 4;
const DEFAULT_POSITION = 1;
const DEFAULT_INTERVAL = 1;

const metadata_keys = {
    prompt: 'note_prompt',
    interval: 'note_interval',
    depth: 'note_depth',
    position: 'note_position',
}

async function onExtensionFloatingPromptInput() {
    chat_metadata[metadata_keys.prompt] = $(this).val();
    saveChatDebounced();
}

async function onExtensionFloatingIntervalInput() {
    chat_metadata[metadata_keys.interval] = Number($(this).val());
    saveChatDebounced();
}

async function onExtensionFloatingDepthInput() {
    let value = Number($(this).val());

    if (value < 0) {
        value = Math.abs(value);
        $(this).val(value);
    }

    chat_metadata[metadata_keys.depth] = value;
    saveChatDebounced();
}

async function onExtensionFloatingPositionInput(e) {
    chat_metadata[metadata_keys.position] = e.target.value;
    saveChatDebounced();
}

function onExtensionFloatingDefaultInput() {
    extension_settings.note.default = $(this).val();
    saveSettingsDebounced();
}

// TODO Remove in next release
function getLocalStorageKeys() {
    const context = getContext();

    let keySuffix;

    if (context.groupId) {
        keySuffix = context.groupId;
    }
    else if (context.characterId) {
        keySuffix = `${context.characters[context.characterId].name}_${context.chatId}`;
    }
    else {
        keySuffix = 'undefined';
    }

    return {
        prompt: `extensions_floating_prompt_${keySuffix}`,
        interval: `extensions_floating_interval_${keySuffix}`,
        depth: `extensions_floating_depth_${keySuffix}`,
        position: `extensions_floating_position_${keySuffix}`,
        default: 'extensions_default_note',
     };
}

function migrateFromLocalStorage() {
    const keys = getLocalStorageKeys();
    const defaultNote = localStorage.getItem(keys.default);
    const prompt = localStorage.getItem(keys.prompt);
    const interval = localStorage.getItem(keys.interval);
    const position = localStorage.getItem(keys.position);
    const depth = localStorage.getItem(keys.depth);

    if (defaultNote !== null) {
        if (typeof extension_settings.note !== 'object') {
            extension_settings.note = {};
        }

        extension_settings.note.default = defaultNote;
        saveSettingsDebounced();
        localStorage.removeItem(keys.default);
    }

    if (chat_metadata) {
        if (interval !== null) {
            chat_metadata[metadata_keys.interval] = interval;
            localStorage.removeItem(keys.interval);
        }

        if (depth !== null) {
            chat_metadata[metadata_keys.depth] = depth;
            localStorage.removeItem(keys.depth);
        }

        if (position !== null) {
            chat_metadata[metadata_keys.position] = position;
            localStorage.removeItem(keys.position);
        }

        if (prompt !== null) {
            chat_metadata[metadata_keys.prompt] = prompt;
            localStorage.removeItem(keys.prompt);
            saveChatDebounced();
        }
    }
}


function loadSettings() {
    migrateFromLocalStorage();
    chat_metadata[metadata_keys.prompt] = chat_metadata[metadata_keys.prompt] ?? extension_settings.note.default ?? '';
    chat_metadata[metadata_keys.interval] = chat_metadata[metadata_keys.interval] ?? DEFAULT_INTERVAL;
    chat_metadata[metadata_keys.position] = chat_metadata[metadata_keys.position] ?? DEFAULT_POSITION;
    chat_metadata[metadata_keys.depth] = chat_metadata[metadata_keys.depth] ?? DEFAULT_DEPTH;
    $('#extension_floating_prompt').val(chat_metadata[metadata_keys.prompt]);
    $('#extension_floating_interval').val(chat_metadata[metadata_keys.interval]);
    $('#extension_floating_depth').val(chat_metadata[metadata_keys.depth]);
    $(`input[name="extension_floating_position"][value="${chat_metadata[metadata_keys.position]}"]`).prop('checked', true);
    $('#extension_floating_default').val(extension_settings.note.default);
}

async function moduleWorker() {
    const context = getContext();

    if (!context.groupId && !context.characterId) {
        return;
    }

    loadSettings();

    // take the count of messages
    let lastMessageNumber = Array.isArray(context.chat) && context.chat.length ? context.chat.filter(m => m.is_user).length : 0;

    // special case for new chat
    if (Array.isArray(context.chat) && context.chat.length === 1) {
        lastMessageNumber = 1;
    }

    if (lastMessageNumber <= 0 || chat_metadata[metadata_keys.interval] <= 0) {
        $('#extension_floating_counter').text('No');
        return;
    }

    const messagesTillInsertion = lastMessageNumber >= chat_metadata[metadata_keys.interval]
        ? (lastMessageNumber % chat_metadata[metadata_keys.interval])
        : (chat_metadata[metadata_keys.interval] - lastMessageNumber);
    const shouldAddPrompt = messagesTillInsertion == 0;
    const prompt = shouldAddPrompt ? $('#extension_floating_prompt').val() : '';
    context.setExtensionPrompt(MODULE_NAME, prompt, chat_metadata[metadata_keys.position], chat_metadata[metadata_keys.depth]);
    $('#extension_floating_counter').text(shouldAddPrompt ? 'This' : messagesTillInsertion);
}

(function() {
    function addExtensionsSettings() {
        const settingsHtml = `
        <h3>작가 노트 / 캐릭터 바이어스</h3>
        <div class="floating_prompt_settings">
            <label for="extension_floating_prompt">다음 텍스트를 추가합니다 :</label>
            <textarea id="extension_floating_prompt" class="text_pole" rows="2"></textarea>
            <label>
                <input type="radio" name="extension_floating_position" value="0" />
                적당한 사용
            </label>
            <label>
                <input type="radio" name="extension_floating_position" value="1" />
                무조건 사용
            </label>
            <br><label for="extension_floating_interval">텍스트 반복 횟수 설정 ( 0 : 비활성화 )</label>
            <input id="extension_floating_interval" class="text_pole" type="number" min="0" max="999" />
            <label for="extension_floating_interval">명령 강도 설정 ( 무조건 사용 설정시 )</label>
            <input id="extension_floating_depth" class="text_pole" type="number" min="0" max="99" />
            <span>프롬프트가 추가되는 메세지 수 : <span id="extension_floating_counter">No</span> message(s)</span>
            <br>
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>새로운 채팅에 적용할 기본 노트</b>
                    <div class="inline-drawer-icon down"></div>
                </div>
                <div class="inline-drawer-content">
                    <label for="extension_floating_default">기본 작가 노트</label>
                    <textarea id="extension_floating_default" class="text_pole" rows="3"
                    placeholder="예시 : [Scenario: wacky adventures; Genre: romantic comedy; Style: verbose, creative]"></textarea>
                </div>
            </div>
        </div>
        `;

        $('#extensions_settings').append(settingsHtml);
        $('#extension_floating_prompt').on('input', onExtensionFloatingPromptInput);
        $('#extension_floating_interval').on('input', onExtensionFloatingIntervalInput);
        $('#extension_floating_depth').on('input', onExtensionFloatingDepthInput);
        $('#extension_floating_default').on('input', onExtensionFloatingDefaultInput);
        $('input[name="extension_floating_position"]').on('change', onExtensionFloatingPositionInput);
    }

    addExtensionsSettings();
    setInterval(moduleWorker, UPDATE_INTERVAL);
})();