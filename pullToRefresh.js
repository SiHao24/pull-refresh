/**
 * 为指定的容器添加滚动条，支持下拉刷新和上拉加载功能
 * @param container 需要的滚动的容器，要求设置css: position != sattic height=
 * @param option配置项，
 * @return 返回对象用于操作次区域，当前暴露了isscroll的refresh函数，当你在插件之外滚动区域增加/删除内容之后应该主动调用一次
 * @description
 * 
 * 
 */
$.installPullToRefresh = function (container, option) {
    // 触摸容器的手指集合
    var touchFingers = {};
    // 集合大小
    var fingerCount = 0;
    // 触摸事件的唯一ID
    var touchEventID = 0;
    // 刷新事件的唯一ID
    var refreshEVentID = 0;
    // 当前加载事件
    var loadEvent = null;
    // 当前图标位置
    var curY = -55;


    // 默认参数
    var defaultOption = {
        // 刷新相关
        noRefresh: false, //关闭下拉刷新特性
        pauseBound: 40, //触发新的位置(也是图标loading暂停的位置)
        lowerBound: 80, //最大下拉到多少像素
        loadImg: 'load.png', //loading图片
        pullIMg: 'pull.png', //下拉图片
        onRefresh: function (refreshDone) { //刷新数据回调
            setTimeout(() => {
                refreshDone();
            }, 0);
        },

        // 加载相关
        noLoad: false, //关闭上拉加载特性
        bottomHeight: 1, //距离滚动条底部多少像素发起刷新
        onLoad: function(loadDone) {
            setTimeout(() => {
                loadDone()
            }, 0);
        }
    };

    var finalOption = $.extend(true, defaultOption, option);

    // 创建isScroll滚动区域
    var isScroll = new IScroll(container, {
        bounce: false
    });

    function handleRemovedTarget() {
        for(var identifier in touchFingers) {
            var finger = touchFingers[identifier];
            if(!$.container($(container).get(0), finger.target)) {
                delete touchFingers[identifier];
                --fingerCount;
            }
        }
    }

    // 关闭上拉加载特性
    if(!finalOption.noLoad) {
        // 监听滚动结束事件，用于上拉加载
        isScroll.on('scrollEnd', function() {
            // 有滚动条的情况下，才允许上拉加载
            if(isScroll.maxScrollY < 0) {
                // maxScrollY<0表明出现了滚动条
                var bottomDistance = (isScroll.maxScrollY - isScroll.y) * -1;
                // 距离底部足够近，触发加载
                if(bottomDistance <= finalOption.bottomHeight) {
                    // 当前没有刷新事件和加载事件正在执行
                    if(!loadEvent && !refreshEVentID) {
                        loadEvent = {}; //生成新的加载事件
                        finalOption.onLoad(function(error, msg) {
                            loadEvent = null; //清理当前加载事件
                            handleRemovedTarget();
                            // 延迟重回滚动条
                            setTimeout(() => {
                                isScroll.refresh();
                            }, 0);
                        })
                    }
                }
            }
        })
    }
    // 关闭下拉刷新特性
    if(!finalOption.noRefresh) {
        // 紧邻滚动区域，容纳刷新图标
        var pullContainer = $('<div class="pullContainer"></div>');
        // 设置下拉条宽度与容器宽度一致
        pullContainer.css('width', $(container).css("width"));
        // 创建小图标
        var pullToRefresh = $('<div class="pullToRefresh"><img src="'+ finalOption.pullIMg + '"></div>');
        // 保留小图标的快捷方式
        var pullImg = pullToRefresh.find("img");
        // 小图标加入到容器
        pullContainer.append(pullToRefresh);
        // 小图标容器添加到滚动区域之前
        $(container).before(pullContainer);
        // 与加载loading
        $('<img src="'+ finalOption.loadImg + '">')

        // 设置transform的函数
        function cssTransform(node, content) {
            node.css({
                '-webkit-transform': content,
                '-moz-transform': content,
                '-ms-transform': content,
                '-o-transform': content,
                'transform': content
            })
        }

        // 调整小图标位置，角度，透明度
        function goTowards(translateY, rotate, opacity) {
            // 更新当前小图标的位置，获取css（transform）比较麻烦，所以每次变更时自己保存
            curY = translateY;
            // 旋转图标（根据抵达lowerBound的比例旋转，最大转一圈）
            if(rotate === undefined) {
                rotate = (curY / finalOption.lowerBound) * 360;
            }
            // 透明度根据抵达pausuBound的比例计算
            if(opacity === undefined) {
                opacity = (curY / finalOption.pauseBound) * 1;
                if(opacity > 1) {
                    opacity = 1;
                }
            }
            // 改变位置和旋转角度
            cssTransform(pullToRefresh, "translateY(" + translateY + "px) translateZ(0)" + "rotateZ(" + rotate + "deg)");
            // 改变透明度
            pullToRefresh.css("opacity", opacity);
        }

        // 开启回弹动画
        function tryStartBackTranTop() {
            // 启动回弹动画
            pullToRefresh.addClass('backTranTop');
            // 判断是否发起刷新
            if(curY >= finalOption.pauseBound) {
                goTowards(finalOption.pauseBound);
                // 回弹动画结束发起刷新
                pullToRefresh.on('transitionEnd webkitTransitioneEnd oTransitionEnd', function (event) {
                    if(event.originalEvent.propertyName == 'transform') {
                        // 暂停动画
                        pullToRefresh.removeClass("backTranTop");
                        pullToRefresh.unbind();
                        // 透明度重置为1
                        goTowards(finalOption.pauseBound, undefined, 1);
                        // 切换图片为loading图
                        pullImg.attr('src', finalOption.loadImg);
                        // 因为animation会覆盖transform的原因，使用top零时定位元素
                        pullToRefresh.addClass('loadingAnimation');
                        pullToRefresh.css('top', finalOption.pauseBound + 'px')
                        // 回调刷新数据，灯带用户回调
                        finalOption.onRefresh(function(error, msg) {
                            // 用户回调时DOM通常已经更新，需要通知isScroll调整（官方建议延迟执行，涉及到浏览器重回问题）
                            setTimeout(() => {
                                isScroll.refresh();
                            }, 0);
                            handleRemovedTarget();
                            // 重置角度，切换为pull图
                            goTowards(finalOption.pauseBound);
                            // 取消animation，重置top
                            pullToRefresh.removeClass('loadingAnimation');
                            pullToRefresh.css('top', '');
                            // 延迟过渡动画100毫秒，给浏览器重绘的机会
                            setTimeout(() => {
                                // 切换为pull图
                                pullImg.attr('src', finalOption.pullImg);
                                // 回复动画
                                pullToRefresh.addClass('backTranTop');
                                // 刷新完成
                                refreshEVentID = 0;
                                // 弹回顶部
                                goTowards(-55);
                                // 滚动条回顶部
                                isScroll.scrollTop(0, 0, 0);
                            }, 100);
                        })
                    }
                })
            }else {
                goTowards(-55); //弹回顶部
                refreshEVentID = 0; //未达成刷新触发事件
            }
        }


        // 更新最新的手指集合
        // 浏览器对changedTouches的实现存在问题，因此总是使用全量的touches进行对比
        function compareTouchFingers(event) {
            var identSet = {};

            // 添加target内新出现的手指
            for(var i = 0; i< event.originalEvent.targetTouches.length; ++i) {
                var touch = event.originalEvent.targetTouches[i];
                identSet[touch.identifier] = true;
                if(touchFingers[touch.identifier] === undefined) {
                    touchFingers[touch.identifier] = { clientY: touch.clientY, target: touch.target };
                    ++fingerCount;
                }
            }

            // 将target内消失的手指移除
            for(var idenfifier in touchFingers) {
                // 与本次touchEvent属于同一个target，但是touchEvent中已消失的手指，需要移除
                if(identSet[identifier] === undefined && touchFingers[identifier].target === event.originalEvent.target) {
                    delete(touchFingers[identifier]);
                    --fingerCount;
                }
            }
        }

        // 统一处理
        $(container).on('touchstart touchmove touched touchcancel', function(event) {
            var beforeFingerCount = fingerCount;
            compareTouchFingers(event);

            if(!beforeFingerCount && fingerCount) { //开始触摸
                ++touchEventID; //新建触摸事件
                if(!refreshEVentID) {
                    // 新建翻页事件
                    refreshEVentID = touchEventID;
                    // 如果存在，则关闭回弹动画与相关监听事件
                    pullToRefresh.removeClass('backTranTop');
                    pullToRefresh.unbind();
                    // 切换为pull图
                    pullImg.attr('src', finalOption.pullImg);
                }
            }else if(beforeFingerCount && !fingerCount) { //结束触摸
                if(touchEventID != refreshEVentID) { //在前一个刷新未完成前进行了触摸，将被忽略
                    return 
                }
                // 解锁isscroll向上拉动
                isScroll.unlockScrollUp();
                // 尝试启动回弹动画
                tryStartBackTranTop();
            }else if(beforeFingerCount) { //正在触摸
                // 计算每哥变化的手指，去变化最大的delta
                var maxDelta = 0;
                for(var i = 0; i < event.originalEvent.changedTouches.length; ++i) {
                    var fingerTouch = event.originalEvent.changedTouches[i];
                    if(touchFingers[fingerTouch.identifier] !== undefined) {
                        var delta = fingerTouch.clientY - touchFingers[fingerTouch.idenfifier].clientY;
                        if(Math.abs(delta) > Math.abs(maxDelta)) {
                            maxDelta = delta;
                        }
                        touchFingers[fingerTouch.identifier].clientY = fingerTouch.clientY;
                    }
                }
                if(touchEventID != refreshEVentID) {
                    return;
                }

                // 滚动条必须达到顶部，才开始下拉刷新动画
                if(isScroll.y != 0) {
                    return;
                }
                // 图标的目标位置
                var desY = curY + maxDelta;
                // 向下不能拉出范围
                if(desY > finalOption.lowerBound) {
                    desY = finalOption.lowerBound;
                }
                // 向上不能拉出范围
                if(desY <= -55) {
                    desY = -55;
                }
                // 更新图标位置
                goTowards(desY);
                // 一旦小图标进入视野，Y周向上的滚动条释放锁定
                if(desY >= 0) {
                    isScroll.lockScrollUp();
                }else { //一旦小图标离开视野，Y轴向上的滚动条释放锁定
                    isScroll.unlockScrollUp();
                }
            }
        })
    }

        // 初始化isscroll
    setTimeout(() => {
        isScroll.refresh()
    }, 0);

    // 返回操作次区域的工具对象
    return {
        // 用户如果在下拉刷新之外修改了滚动区域的内容，需要主动调用refresh
        refresh: function() {
            // 延迟一边配合浏览器重绘
            setTimeout(() => {
                isScroll.refresh();
                handleRemovedTarget();
            }, 0);
        },
        // 触发下拉刷新
        triggerPull: function() {
            // 正在刷新或停止刷新
            if(refreshEVentID || finalOption.noRefresh) {
                return false;
            }
            // 滚动到顶部
            isScroll.scrollTo(0, 0, 0);
            // 暂停可以正在进行的最终阶段回弹动画
            pullToRefresh.removeClass('backTranTop');
            // 小图标移动到lowerbound位置
            goTowards(finalOption.lowerBound);
            // 创建新的刷新事件，占坑可以阻止在setTimeout之前的触摸引起刷新
            refreshEVentID = -1; //负值可以忽略任何触摸事件，直到刷新完成 
            // 延迟到浏览器重绘
            setTimeout(() => {
                tryStartBackTranTop();
            }, 100);
        }
    }
}