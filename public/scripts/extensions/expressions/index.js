import { saveSettingsDebounced } from "../../../script.js";
import { getContext, getApiUrl, modules, extension_settings } from "../../extensions.js";
export { MODULE_NAME };

const MODULE_NAME = 'expressions';
const UPDATE_INTERVAL = 1000;
const DEFAULT_EXPRESSIONS = ['anger', 'fear', 'joy', 'love', 'sadness', 'surprise'];

let expressionsList = null;
let lastCharacter = undefined;
let lastMessage = null;
let inApiCall = false;

function onExpressionsShowDefaultInput() {
    const value = $(this).prop('checked');
    extension_settings.expressions.showDefault = value;
    saveSettingsDebounced();

    const existingImageSrc = $('img.expression').prop('src');
    if (existingImageSrc !== undefined) {                      //if we have an image in src
        if (!value && existingImageSrc.includes('/img/default-expressions/')) {    //and that image is from /img/ (default)
            $('img.expression').prop('src', '');               //remove it
            lastMessage = null;
        }
        if (value) {
            lastMessage = null;
        }
    }
}

async function moduleWorker() {
    function getLastCharacterMessage() {
        const reversedChat = context.chat.slice().reverse();

        for (let mes of reversedChat) {
            if (mes.is_user || mes.is_system) {
                continue;
            }

            return mes.mes;
        }

        return '';
    }

    const context = getContext();

    // group chats and non-characters not supported
    if (context.groupId || !context.characterId) {
        removeExpression();
        return;
    }

    // character changed
    if (lastCharacter !== context.characterId) {
        removeExpression();
        validateImages();
    }

    if (!modules.includes('classify')) {
        $('.expression_settings').show();
        $('.expression_settings .offline_mode').css('display', 'block');
        lastCharacter = context.characterId;
        return;
    }
    else {
        $('.expression_settings .offline_mode').css('display', 'none');
    }

    // check if last message changed
    const currentLastMessage = getLastCharacterMessage();
    if (lastCharacter === context.characterId && lastMessage === currentLastMessage) {
        return;
    }

    // API is busy
    if (inApiCall) {
        return;
    }

    try {
        inApiCall = true;
        const url = new URL(getApiUrl());
        url.pathname = '/api/classify';

        const apiResult = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Bypass-Tunnel-Reminder': 'bypass',
            },
            body: JSON.stringify({ text: currentLastMessage })
        });

        if (apiResult.ok) {
            const data = await apiResult.json();
            const expression = data.classification[0].label;
            setExpression(context.name2, expression);
        }

    }
    catch (error) {
        console.log(error);
    }
    finally {
        inApiCall = false;
        lastCharacter = context.characterId;
        lastMessage = currentLastMessage;
    }
}

function removeExpression() {
    lastMessage = null;
    $('img.expression').prop('src', '');
    $('img.expression').removeClass('default');
    $('.expression_settings').hide();
}

let imagesValidating = false;

async function validateImages() {
    if (imagesValidating) {
        return;
    }

    imagesValidating = true;
    const context = getContext();
    $('.expression_settings').show();
    $('#image_list').empty();

    if (!context.characterId) {
        imagesValidating = false;
        return;
    }

    const IMAGE_LIST = (await getExpressionsList()).map(x => `${x}.png`);
    IMAGE_LIST.forEach((item) => {
        const image = document.createElement('img');
        image.src = `/characters/${context.name2}/${item}`;
        image.classList.add('debug-image');
        image.width = '0px';
        image.height = '0px';
        image.onload = function () {
            $('#image_list').append(getListItem(item, image.src, 'success'));
        }
        image.onerror = function () {
            $('#image_list').append(getListItem(item, '/img/No-Image-Placeholder.svg', 'failure'));
        }
        $('#image_list').prepend(image);
    });
    imagesValidating = false;
}

function getListItem(item, imageSrc, textClass) {
    return `
        <div id="${item}" class="expression_list_item">
            <span class="expression_list_title ${textClass}">${item}</span>
            <img class="expression_list_image" src="${imageSrc}" />
        </div>
    `;
}

async function getExpressionsList() {
    // get something for offline mode (6 default images)
    if (!modules.includes('classify')) {
        return DEFAULT_EXPRESSIONS;
    }

    if (Array.isArray(expressionsList)) {
        return expressionsList;
    }

    const url = new URL(getApiUrl());
    url.pathname = '/api/classify/labels';

    try {
        const apiResult = await fetch(url, {
            method: 'GET',
            headers: { 'Bypass-Tunnel-Reminder': 'bypass' },
        });

        if (apiResult.ok) {
            const data = await apiResult.json();
            expressionsList = data.labels;
            return expressionsList;
        }
    }
    catch (error) {
        console.log(error);
        return [];
    }
}

async function setExpression(character, expression, force) {
    const filename = `${expression}.png`;
    const debugImageStatus = document.querySelector(`#image_list div[id="${filename}"] span`);

    if (force || (debugImageStatus && !debugImageStatus.classList.contains('failure'))) {
        //console.log('setting expression from character images folder');
        const imgUrl = `/characters/${character}/${filename}`;
        $('img.expression').prop('src', imgUrl);
        $('img.expression').removeClass('default');
    } else {
        if (extension_settings.expressions.showDefault) {
            //console.log('no character images, trying default expressions');
            const defImgUrl = `/img/default-expressions/${filename}`;
            //console.log(defImgUrl);
            $('img.expression').prop('src', defImgUrl);
            $('img.expression').addClass('default');
        }
    }
}

function onClickExpressionImage() {
    // online mode doesn't need force set
    if (modules.includes('classify')) {
        return;
    }

    const context = getContext();
    const expression = $(this).attr('id').replace('.png', '');

    if ($(this).find('.failure').length === 0) {
        setExpression(context.name2, expression, true);
    }
}

(function () {
    function addExpressionImage() {
        const html = `<div class="expression-holder"><img class="expression"></div>`;
        $('body').append(html);
    }
    function addSettings() {
        const html = `
        <div class="expression_settings">
            <h3>감정 표현 이미지</h3>
            <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>감정 이미지 프리뷰</b>
                <div class="inline-drawer-icon down"></div>
            </div>
            <div class="inline-drawer-content">
                <p class="offline_mode">오프라인 상태입니다!<br>아래에서 기본 감정 이미지를 확인할 수 있습니다.</p>
                <div id="image_list"></div>
                <p class="hint"><b>힌트 :</b> <i><b>public/characters/</b>위치에 캐릭터 이름의 폴더를 만들고 위 감정 이름에 해당하는 이미지를 넣어주세요.</i></p>
                </div>
            </div>
            <label for="expressions_show_default"><input id="expressions_show_default" type="checkbox">감정 이미지가 없을 시 이모지로 대체</label>
        </div>
        `;
        $('#extensions_settings').append(html);
        $('#expressions_show_default').on('input', onExpressionsShowDefaultInput);
        $('#expressions_show_default').prop('checked', extension_settings.expressions.showDefault).trigger('input');
        $(document).on('click', '.expression_list_item', onClickExpressionImage);
        $('.expression_settings').hide();
    }

    addExpressionImage();
    addSettings();
    setInterval(moduleWorker, UPDATE_INTERVAL);
})();