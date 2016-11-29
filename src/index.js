/**
 * classes/Draggable
 * @author ydr.me
 * @create 2016-04-25 11:27
 */



'use strict';

var Events =       require('blear.classes.events');
var event =        require('blear.core.event');
var selector =     require('blear.core.selector');
var attribute =    require('blear.core.attribute');
var layout =       require('blear.core.layout');
var modification = require('blear.core.modification');
var access =       require('blear.utils.access');
var object =       require('blear.utils.object');
var date =         require('blear.utils.date');
var number =       require('blear.utils.number');

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
            style: {
                display: 'none',
                position: 'absolute',
                background: '#000',
                opacity: 0.3,
                border: '1px solid #eee'
            }
        });

        var moveEl = shadow ? shadowEl : null;
        var effectedEl = null;
        var effectedSelector = options.effectedSelector || containerEl;
        var handleSelector = options.handleSelector || effectedSelector;
        var fixEvent = function (ev) {
            var firstEv = ev;

            if (ev.changedTouches && ev.changedTouches.length) {
                firstEv = ev.changedTouches[0];
            }

            if (ev.touches && ev.touches.length) {
                firstEv = ev.touches[0];
            }

            try {
                object.assign(ev, {
                    clientX: firstEv.clientX,
                    clientY: firstEv.clientY
                });
            } catch (err) {
                // ignore
            }

            return ev;
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
            ev = fixEvent(ev);
            meta.startX = meta.moveX = ev.clientX;
            meta.startY = meta.moveY = ev.clientY;
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
            meta.originalEvent = ev;

            if (the.emit('dragStart', object.assign({}, meta)) === false) {
                the[_onDragEnd](ev);
            }

            if (the[_hasPreventDefault]) {
                ev.preventDefault();
            }
        });

        event.on(doc, DRAG_MOVE_EVENT_TYPE, the[_onDragMove] = function (ev) {
            if (!dragging) {
                return;
            }

            ev = fixEvent(ev);
            meta.moveX = ev.clientX;
            meta.moveY = ev.clientY;
            meta.deltaX = meta.moveX - meta.startX;
            meta.deltaY = meta.moveY - meta.startY;
            meta.originalEvent = ev;

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
                ev.preventDefault();
            }
        });

        event.on(doc, DRAG_END_EVENT_TYPE, the[_onDragEnd] = function (ev) {
            if (!dragging) {
                return
            }

            ev = fixEvent(ev);
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

            meta.endX = ev.clientX;
            meta.endY = ev.clientY;
            meta.deltaX = meta.endX - meta.startX;
            meta.deltaY = meta.endY - meta.startY;
            meta.endTime = date.now();
            meta.originalEvent = ev;
            the.emit('dragEnd', object.assign({}, meta));
            moveEl = shadow ? shadowEl : null;
            effectedEl = null;
            meta = object.assign({}, originalMeta, {
                containerEl: containerEl
            });
            dragging = false;

            if (the[_hasPreventDefault]) {
                ev.preventDefault();
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
var _containerEl = Draggable.sole();
var _hasPreventDefault = Draggable.sole();
var _disabled = Draggable.sole();
var _onDragStart = Draggable.sole();
var _onDragMove = Draggable.sole();
var _onDragEnd = Draggable.sole();
var _canHorizontal = Draggable.sole();
var _canVertical = Draggable.sole();
var _zIndex = Draggable.sole();


Draggable.defaults = defaults;
module.exports = Draggable;
