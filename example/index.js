/**
 * 文件描述
 * @author ydr.me
 * @create 2016-06-27 17:34
 */


'use strict';

var Draggable = require('../src/index');

var draggable = new Draggable({
    containerEl: '#demo'
});

draggable.on('dragStart', function (meta) {
    console.log(meta);
});

draggable.on('dragMove', function (meta) {
    console.log(meta);
});

draggable.on('dragEnd', function (meta) {
    console.log(meta);
});
