export default {
  name: 'VueFlowRender',
  props: {
    column: {
      type: Number,
      default: 1,
      validator: val => val >= 1
    },
    height: {
      type: Number,
      default: 0,
      validator: val => val >= 0
    },
    remain: {
      type: Number,
      required: true
    },
    total: {
      type: Number,
      required: true
    },
    item: {
      type: Object,
      default: null
    },
    getter: {
      type: Function,
      default: () => {}
    }
  },
  data() {
    return {
      wrap: null,
      wrapHeight: 0,
      offsetTop: 0,
      lastScrollTop: 0,
      isUp: false,
      start: 0,
      style: {
        height: 0,
        paddingTop: 0
      },
      cache: {}
    }
  },
  computed: {
    isSameHeight() {
      return this.height !== 0
    },
    isSingleColumn() {
      return this.column === 1
    }
  },
  watch: {
    total(newVal, oldVal) {
      if (!newVal) {
        this.clear()
      } else if (newVal < oldVal) {
        this.clear()
        this._computeRenderHeight(this.$slots.default, 0)
      } else {
        this._computeRenderHeight(this.isSameHeight ? undefined : this.$slots.default.slice(oldVal, newVal), oldVal)
      }
      this.wrapHeight = this.wrap.clientHeight
    }
  },
  mounted() {
    this.setOffset()
    this.setWrap()
    this._computeRenderHeight(this.$slots.default, 0)
  },
  beforeUpdate() {
    this._adjustStart()
  },
  methods: {
    setOffset() {
      this.offsetTop = this.$el.offsetTop
    },
    setWrap(el) {
      this.wrap = el || this.$el.parentElement
      this.wrapHeight = this.wrap.clientHeight
    },
    getRect(index) {
      return this.cache[index]
    },
    scroll(offset, up) {
      this.isUp = up === undefined ? offset < this.lastScrollTop : up
      this.lastScrollTop = offset
      const { start, remain, cache, offsetTop, isUp, total, wrapHeight } = this
      /**
       * 元素比较少，还不需要懒加载
       */
      if (remain >= total) {
        return
      }
      /**
       * 实际的滚动的高度要减去 offset
       */
      const scrollTop = offset - offsetTop
      /**
       * 位移修正（iOS offset 可能为负值）
       */
      if (scrollTop <= 0) {
        this.start = 0
        this.style.paddingTop = 0
        return
      }
      /**
       * 向上
       */
      if (isUp) {
        /**
         * 触顶，数值修正
         */
        if (this.start <= 0) {
          this.style.paddingTop = 0
          this.start = 0
          return
        }
        /**
         * 1. 当前列表最后一个元素的顶部已经离开视口
         * 2. 当前列表的第一个元素的顶部已经进入视口
         */
        if (
          cache[start + remain - 1].top > scrollTop + wrapHeight ||
          cache[start].top > scrollTop
        ) {
          this.style.paddingTop -= cache[start - 1].height
          this.start--
        }
      } else {
        /**
         * 触底，数值修正
         */
        if (start + remain >= total) {
          this.start = total - remain
          this.style.paddingTop = cache[total - remain].top
          return
        }
        /**
         * 1. 当前列表的第一个元素的底部已经离开视口
         * 2. 当前列表的最后一个元素底部已经进入视口
         */
        if (
          cache[start].bottom < scrollTop ||
          cache[start + remain - 1].bottom < scrollTop + wrapHeight
        ) {
          this.style.paddingTop += cache[start].height
          this.start++
        }
      }
    },
    clear() {
      this.style = {
        height: 0,
        paddingTop: 0
      }
      this.cache = {}
      this.start = 0
    },
    _adjustStart() {
      const { lastScrollTop, cache, start, isSameHeight, height, remain, column, offsetTop, total, wrapHeight } = this
      /**
       * 元素比较少，还不需要懒加载
       */
      if (remain >= total) {
        return
      }
      /**
       * 如果在顶部，则直接修正
       */
      const scrollTop = lastScrollTop - offsetTop
      if (scrollTop <= 0) {
        this.style.paddingTop = 0
        this.start = 0
        return
      }
      /**
       * 如果触底了，则直接修正
       */
      const scrollBottom = lastScrollTop - offsetTop + wrapHeight
      if (scrollBottom >= cache[total - 1].bottom) {
        this.start = total - remain
        this.style.paddingTop = cache[total - remain].top
        return
      }
      /**
       * 向上修正
       */
      const adjustUp = () => {
        const detectRect = cache[start]
        const deltaHeight = detectRect.top - scrollTop
        /**
         * 如果当前列表的第一个元素的顶部在视口的上方，则不用修正
         */
        if (deltaHeight <= 0) {
          return
        }
        if (isSameHeight) {
          /**
           * 如果元素是等高的，直接根据高度差算出需要修正的距离
           */
          const decreaseCount = Math.abs(Math.ceil(deltaHeight / height / column))
          this.start -= decreaseCount
          this.style.paddingTop -= decreaseCount * height
        } else {
          /**
           * 如果元素不等高
           * 从当前列表的上一个元素开始，到第 0 个元素结束开始循环
           * 寻找第一个顶部在视口边界的元素
           */
          for (let i = start - 1; i >= 0; i--) {
            if (cache[i].top <= scrollTop) {
              const index = Math.max(i - (remain / 2 | 0), 0)
              this.style.paddingTop = cache[index].top
              this.start = index
              break
            }
          }
        }
      }
      /**
       * 向下修正
       */
      const adjustDown = () => {
        const detectRect = cache[start + remain - 1]
        const deltaHeight = detectRect.bottom - scrollBottom
        /**
         * 如果当前列表的最后一个元素的底部在视口的下方，则不用修正
         */
        if (deltaHeight >= 0) {
          return
        }
        if (isSameHeight) {
          /**
           * 如果元素是等高的，直接根据高度差算出需要修正的距离
           */
          const increaseCount = Math.abs(Math.floor(deltaHeight / height / column))
          this.start += increaseCount
          this.style.paddingTop += increaseCount * height
        } else {
          /**
           * 如果元素不等高
           * 从最后一个元素的下一个元素开始，到最后一个元素开始循环
           * 寻找第一个底部在视口边界的元素
           */
          for (let i = start + remain; i < total; i++) {
            if (cache[i].bottom >= scrollBottom) {
              const index = Math.min(i - (remain / 2 | 0), total - remain)
              this.style.paddingTop = cache[index].top
              this.start = index
              break
            }
          }
        }
      }
      /**
       * 向上滚动很久后忽然再向下再停止就会按照是向下滚动去修复了
       * 所以这里只能对上下都进行修复
       */
      adjustUp()
      adjustDown()
    },
    _computeRenderHeight(items, offset) {
      const { height, isSameHeight, total, column, cache, isSingleColumn } = this
      if (!total) {
        return
      }
      if (isSameHeight) {
        const end = items ? items.length : total - offset
        for (let i = 0; i < end; i++) {
          const top = height * Math.floor((i + offset) / column)
          cache[i + offset] = {
            height,
            top,
            bottom: height + top
          }
        }
        this.style.height = height * total / column
      } else {
        if (isSingleColumn) {
          let beforeHeight = offset ? cache[offset - 1].bottom : 0
          items.forEach((item, index) => {
            const hgt = +item.data.style.height.replace('px', '')
            cache[index + offset] = {
              height: hgt,
              top: beforeHeight,
              bottom: hgt + beforeHeight
            }
            beforeHeight += hgt
          })
          this.style.height = beforeHeight
        } else {
          let offsets
          if (offset) {
            offsets = []
            for (let i = offset - column, end = offset - 1; i <= end; i++) {
              offsets.push(cache[i].bottom)
            }
          } else {
            offsets = new Array(column).fill(0)
          }
          items.forEach((item, index) => {
            const realIndex = index + offset
            const beforeHeight = Math.min(...offsets)
            const hgt = +item.data.style.height.replace('px', '')
            cache[realIndex] = {
              height: hgt,
              top: beforeHeight,
              bottom: hgt + beforeHeight
            }
            offsets[offsets.indexOf(beforeHeight)] += hgt
          })
          this.style.height = Math.max(...offsets)
        }
      }
    },
    _filter(h) {
      const { remain, total, start, item, getter } = this
      const end = remain >= total ? total : start + remain

      if (item) {
        const result = []
        for (let i = start; i < end; i++) {
          result.push(h(item, getter(i)))
        }
        return result
      }

      if (!this.$slots.default) {
        return []
      }
      return this.$slots.default.slice(start, end)
    }
  },
  render: function(h) {
    const { paddingTop, height } = this.style
    const list = this._filter(h)

    return h('div', {
      'style': {
        boxSizing: 'border-box',
        height: `${height}px`,
        paddingTop: `${paddingTop}px`,
        willChange: 'padding-top'
      },
      'class': 'vue-flow-render'
    }, list)
  }
}
