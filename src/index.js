/**
 * classes/Draggable
 * @author ydr.me
 * @create 2016-04-25 11:27
 * @update 2018年06月20日19:19:10
 */



'use strict';

var Events = require('blear.classes.events');
var event = require('blear.core.event');
var selector = require('blear.core.selector');
var attribute = require('blear.core.attribute');
var layout = require('blear.core.layout');
var modification = require('blear.core.modification');
var access = require('blear.utils.access');
var object = require('blear.utils.object');
var date = require('blear.utils.date');
var number = require('blear.utils.number');

var win = window;
var doc = win.document;
var htmlEl = doc.documentElement;
var reHorizontal = /x/i;
var reVertical = /y/i;
var DRAG_START_EVENT_TYPE = 'mousedown touchstart';
var DRAG_MOVE_EVENT_TYPE = 'mousemove touchmove';
var DRAG_END_EVENT_TYPE = 'mouseup touchend touchcancel';
var defaults = {
    /**
     * 容器
     * @type String|HTMLElement|null
     */
    containerEl: null,

    /**
     * 拖拽被影响者
     * @type String|HTMLElement|null
     */
    effectedSelector: null,

    /**
     * 拖拽处理者
     * @type String|HTMLElement|null
     */
    handleSelector: null,

    /**
     * 是否拖拽是出现影子来代替移动
     */
    shadow: true,

    shadowStyle: {
        background: '#000',
        opacity: 0.3,
        border: '1px solid #eee'
    },

    /**
     * 是否取消默认
     * @type Boolean
     */
    preventDefault: true,

    /**
     * 是否可拖动，设置为 false 时让继承者去处理
     * @type Boolean
     */
    draggable: true,

    /**
     * 坐标轴
     * @type String
     */
    axis: 'xy',

    /**
     * 层级值
     * @type Number
     */
    zIndex: 9999,

    /**
     * 位置变化动画
     * @param el
     * @param to
     * @param done
     */
    resizeAnimation: function (el, to, done) {
        attribute.style(el, to);
        done();
    }
};

/**
 * @class Draggable
 * @extends Events
 * @description
 * 元素关系描述
 * ```
 * <ul> -------------------> container
 *     <li> ---------------> effected
 *         <header> -------> handle
 *         <body>
 *         <footer>
 *     </li>
 *     ....
 * </ul>
 * ```
 */
var Draggable = Events.extend({
    className: 'Draggable',
    constructor: function (options) {
        var the = this;

        options = object.assign(true, {}, defaults, options);
        Draggable.parent(the, options);

        // init node
        var containerEl = the[_containerEl] = selector.query(options.containerEl)[0];
        var shadow = options.shadow;
        var draggable = options.draggable;
        var shadowEl = modification.create('div', {
            style: object.assign(options.shadowStyle, {
                display: 'none',
                position: 'absolute'
            })
        });

        var moveEl = shadow ? shadowEl : null;
        var effectedEl = null;
        var effectedSelector = options.effectedSelector || containerEl;
        var handleSelector = options.handleSelector || effectedSelector;
        var touchEvent = function (ev) {
            var touch0 = null;
            var touch1 = null;
            var length = 0;

            if (ev.touches && (length = ev.touches.length)) {
                touch0 = ev.touches[0];
                touch1 = ev.touches[1];
            }

            if (!touch0 && ev.targetTouches && (length = ev.targetTouches.length)) {
                touch0 = ev.targetTouches[0];
                touch1 = ev.targetTouches[1];
            }

            if (!touch0 && ev.changedTouches && (length = ev.changedTouches.length)) {
                touch0 = ev.changedTouches[0];
                touch1 = ev.changedTouches[1];
            }

            return {
                orginalEvent: ev,
                touch0: touch0 || ev,
                touch1: touch1 || null,
                length: length
            };
        };
        //clientX 设置或获取鼠标指针位置相对于当前窗口的 x 坐标，其中客户区域不包括窗口自身的控件和滚动条。
        //clientY 设置或获取鼠标指针位置相对于当前窗口的 y 坐标，其中客户区域不包括窗口自身的控件和滚动条。
        //offsetX 设置或获取鼠标指针位置相对于触发事件的对象的 x 坐标。
        //offsetY 设置或获取鼠标指针位置相对于触发事件的对象的 y 坐标。
        //screenX 设置或获取获取鼠标指针位置相对于用户屏幕的 x 坐标。
        //screenY 设置或获取鼠标指针位置相对于用户屏幕的 y 坐标。
        var meta = {
            containerEl: containerEl,
            effectedEl: null,
            handleEl: null,
            startTime: 0,
            startX: 0,
            startY: 0,
            moveX: 0,
            moveY: 0,
            deltaX: 0,
            deltaY: 0,
            endTime: 0,
            endX: 0,
            endY: 0
        };
        var originalMeta = meta;
        var startOffsetLeft = 0;
        var startOffsetTop = 0;
        var lastOffsetLeft = 0;
        var lastOffsetTop = 0;
        var dragging = false;

        the[_disabled] = false;
        the[_hasPreventDefault] = options.preventDefault;
        the[_canHorizontal] = reHorizontal.test(options.axis);
        the[_canVertical] = reVertical.test(options.axis);
        the[_zIndex] = options.zIndex;
        modification.insert(shadowEl);

        // init event
        event.on(containerEl, DRAG_START_EVENT_TYPE, handleSelector, the[_onDragStart] = function (ev) {
            if (dragging || the[_disabled]) {
                return;
            }

            dragging = true;
            ev = touchEvent(ev);
            var touch0 = ev.touch0;
            var touch1 = ev.touch1;
            var oe = ev.orginalEvent;
            meta.startX = meta.moveX = touch0.clientX;
            meta.startY = meta.moveY = touch0.clientY;
            meta.startTime = date.now();
            var el = meta.handleEl = this;
            effectedEl = meta.effectedEl = selector.closest(el, effectedSelector)[0];
            moveEl = moveEl || effectedEl;

            if (shadow) {
                attribute.style(moveEl, {
                    display: 'block',
                    zIndex: the[_zIndex],
                    top: layout.offsetTop(effectedEl),
                    left: layout.offsetLeft(effectedEl),
                    width: layout.outerWidth(effectedEl),
                    height: layout.outerHeight(effectedEl)
                });
            }

            lastOffsetLeft = startOffsetLeft = layout.offsetLeft(moveEl);
            lastOffsetTop = startOffsetTop = layout.offsetTop(moveEl);
            attribute.css(htmlEl, {
                cursor: 'move',
                touchCallout: 'none',
                userSelect: 'none'
            });
            meta.originalEvent = oe;
            meta.touch0 = touch0;
            meta.touch1 = touch1;
            meta.length = ev.length;

            if (the.emit('dragStart', object.assign({}, meta)) === false) {
                the[_onDragEnd](ev);
            }

            if (the[_hasPreventDefault]) {
                oe.preventDefault();
            }
        });

        event.on(doc, DRAG_MOVE_EVENT_TYPE, the[_onDragMove] = function (ev) {
            if (!dragging) {
                return;
            }

            ev = touchEvent(ev);
            var touch0 = ev.touch0;
            var touch1 = ev.touch1;
            var oe = ev.orginalEvent;

            meta.moveX = touch0.clientX;
            meta.moveY = touch0.clientY;
            meta.deltaX = meta.moveX - meta.startX;
            meta.deltaY = meta.moveY - meta.startY;
            meta.originalEvent = oe;
            meta.touch0 = touch0;
            meta.length = ev.length;
            meta.touch1 = touch1;

            if (the[_canHorizontal] && draggable) {
                layout.offsetLeft(moveEl, lastOffsetLeft = startOffsetLeft + meta.deltaX);
            }

            if (the[_canVertical] && draggable) {
                layout.offsetTop(moveEl, lastOffsetTop = startOffsetTop + meta.deltaY);
            }

            if (the.emit('dragMove', object.assign({}, meta)) === false) {
                the[_onDragEnd](ev);
            }

            if (the[_hasPreventDefault]) {
                oe.preventDefault();
            }
        });

        event.on(doc, DRAG_END_EVENT_TYPE, the[_onDragEnd] = function (ev) {
            if (!dragging) {
                return
            }

            ev = touchEvent(ev);
            var touch0 = ev.touch0;
            var touch1 = ev.touch1;
            var oe = ev.orginalEvent;
            attribute.style(htmlEl, {
                cursor: '',
                touchCallout: '',
                userSelect: ''
            });

            if (shadow) {
                attribute.hide(moveEl);
                layout.offsetLeft(effectedEl, lastOffsetLeft);
                layout.offsetTop(effectedEl, lastOffsetTop);
            }

            // 这里不从 touch0.clientX 上取值的原因是：
            // 结束后的 clientX 可能与最后一次移动的值有出入
            // 因此取最后一次移动的值更加科学一些
            meta.endX = meta.moveX;
            meta.endY = meta.moveY;
            meta.deltaX = meta.endX - meta.startX;
            meta.deltaY = meta.endY - meta.startY;
            meta.endTime = date.now();
            meta.originalEvent = oe;
            meta.touch0 = touch0;
            meta.touch1 = touch1;
            meta.length = ev.length;
            the.emit('dragEnd', object.assign({}, meta));
            moveEl = shadow ? shadowEl : null;
            effectedEl = null;
            meta = object.assign({}, originalMeta, {
                containerEl: containerEl
            });
            dragging = false;

            if (the[_hasPreventDefault]) {
                oe.preventDefault();
            }
        });
    },

    /**
     * 启用拖拽
     * @returns {Draggable}
     */
    enable: function () {
        var the = this;

        the[_disabled] = false;

        return the;
    },

    /**
     * 禁用拖拽
     * @returns {Draggable}
     */
    disable: function () {
        var the = this;

        the[_disabled] = true;

        return the;
    },

    /**
     * 阻止默认
     * @returns {Draggable}
     */
    preventDefault: function () {
        var the = this;

        the[_hasPreventDefault] = true;

        return the;
    },

    /**
     * 阻止默认
     * @returns {Draggable}
     */
    allowDefault: function () {
        var the = this;

        the[_hasPreventDefault] = false;

        return the;
    },

    /**
     * 获取、设置水平方向拖动能力
     * @param boolean
     * @returns {*}
     */
    horizontal: function (boolean) {
        var the = this;
        var args = access.args(arguments);

        if (!args.length) {
            return the[_canHorizontal];
        }

        the[_canHorizontal] = Boolean(boolean);

        return the;
    },

    /**
     * 获取、设置垂直方向拖动能力
     * @param boolean
     * @returns {*}
     */
    vertical: function (boolean) {
        var the = this;
        var args = access.args(arguments);

        if (!args.length) {
            return the[_canVertical];
        }

        the[_canVertical] = Boolean(boolean);

        return the;
    },


    zIndex: function (zIndex) {
        var the = this;
        var args = access.args(arguments);

        if (!args.length) {
            return the[_zIndex];
        }

        _zIndex = number.parseInt(zIndex);

        return the;
    },

    /**
     * 销毁实例
     */
    destroy: function () {
        var the = this;

        event.un(the[_containerEl], DRAG_START_EVENT_TYPE, the[_onDragStart]);
        event.un(doc, DRAG_MOVE_EVENT_TYPE, the[_onDragMove]);
        event.un(doc, DRAG_END_EVENT_TYPE, the[_onDragEnd]);
        Draggable.invoke('destroy', the);
    }
});
var sole = Draggable.sole;
var _containerEl = sole();
var _hasPreventDefault = sole();
var _disabled = sole();
var _onDragStart = sole();
var _onDragMove = sole();
var _onDragEnd = sole();
var _canHorizontal = sole();
var _canVertical = sole();
var _zIndex = sole();


Draggable.defaults = defaults;
module.exports = Draggable;
