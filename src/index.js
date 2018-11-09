import fs from 'fs'

// 加载样式表
!function() {
  let styleStr = fs.readFileSync(__dirname + '/css/style.css', 'utf8')
  const styleEl = document.getElementById('gameStylesheet')
  if (styleEl) return
  const newStyleEl = document.createElement('style')
  newStyleEl.type = 'text/css'
  newStyleEl.id = 'gameStylesheet'
  newStyleEl.innerHTML = styleStr
  document.head.appendChild(newStyleEl)
}()

// 加载资源
const iconSources = (() => {
  const bufIcons = {
    bg: fs.readFileSync(__dirname + '/img/bg.jpg'),
    blockEnd: fs.readFileSync(__dirname + '/img/back.png'),
    blockFront: fs.readFileSync(__dirname + '/img/front.png'),
    bomb: fs.readFileSync(__dirname + '/img/bomb.png'),
    bombActive: fs.readFileSync(__dirname + '/img/bomb-color.png'),
    flag: fs.readFileSync(__dirname + '/img/flag.png'),
    flagActive: fs.readFileSync(__dirname + '/img/flag-color.png')
  }
  const rtnIcons = {}
  Object.keys(bufIcons).forEach(_ => 
    rtnIcons[_] = `data:image/png;base64,${bufIcons[_].toString('base64')}`
  )
  return rtnIcons
})()

let gameIcons = {}

// 方块类
class Block {
  constructor({ row, col, num = 0 }) {
    this.row = row
    this.col = col
    this.num = num
    this.isFlag = false
    this.isOpened = false
  }

  drawText({ context, size, space }) {
    let fontSize = size / 2 + 'px'
    let color = ({ 1: '#ff0', 2: '#0f0' })[this.num] || '#f00'
    let fw = context.measureText(this.num).width
    let tx = this.col * size + (size - space - fw) / 2
    let ty = this.row * size + (size - space - fw) / 2
    context.save()
    context.font = `bold ${fontSize} serif`
    context.textBaseline = 'hanging'
    context.fillStyle = color
    context.fillText(this.num, tx, ty)
    context.restore()
  }

  drawIcon({ context, size, space, icon }) {
    let dw, dh
    if (icon.width > icon.height) {
      dw = size * .5
      dh = dw * (icon.height / icon.width)
    } else {
      dh = size * .5
      dw = dh * (icon.width / icon.height)
    }
    let dx = this.col * size + space + (size - space - dw) / 2
    let dy = this.row * size + space + (size - space - dh) / 2
    context.drawImage(icon, dx, dy, dw, dh)
  }

  drawBG({ context, size, space, icon }) {
    context.drawImage(
      icon, 0, 0, icon.width, icon.height,
      this.col * size + space, this.row * size + space, size - space, size - space
    )
  }

  draw({ context, size, space = 6 }) {
    if (this.isOpened) {
      this.drawBG({ context, size, space, icon: gameIcons.blockEnd })
      if (!this.num) return
      if (this.num === 9) {
        this.drawIcon({ context, size, space, icon: gameIcons.bomb })
      } else {
        this.drawText({ context, size, space })
      }
    } else {
      this.drawBG({ context, size, space, icon: gameIcons.blockFront })
      if (this.isFlag) {
        this.drawIcon({ context, size, space, icon: gameIcons.flagActive })
      }
    }
  }
}

// 面板类
class Panel {
  constructor({ rows, cols, mineCount, blockSpace = 6 }) {
    this.rows = rows
    this.cols = cols
    this.mineCount = mineCount
    this.blockSpace = blockSpace
    this.blockSize = null
    this.pixRatio = 1
    const { canvas, context } = this.createCanvas()
    this.canvas = canvas
    this.context = context
    this.initLayout()
    this.addListener()
  }

  initLayout() {
    this.isEnd = false
    this.isFirstClick = true
    this.updateSize()
    this.blocks = this.initBlocks(this.rows, this.cols)
    this.reDraw()
  }

  createCanvas() {
    const wrapper = document.createElement('div')
    const canvas = document.createElement('canvas')
    wrapper.className = 'game-wrapper'
    canvas.className = 'game-ui'
    const context = canvas.getContext('2d')
    wrapper.appendChild(canvas)
    document.body.appendChild(wrapper)
    return { canvas, context }
  }

  getPixRatio() {
    var backingStore = this.context.backingStorePixelRatio ||
      this.context.webkitBackingStorePixelRatio ||
      this.context.mozBackingStorePixelRatio || 1
    return (window.devicePixelRatio || 1) / backingStore
  }

  updateSize() {
    let pixRatio = this.getPixRatio()
    let width = this.canvas.offsetWidth
    let canvasHeight, canvasWidth = pixRatio * width
    this.blockSize = (canvasWidth - this.blockSpace) / this.cols
    let maxHeight = pixRatio * (window.innerHeight - 100)
    if (this.rows) {
      if (this.rows * this.blockSize > maxHeight) {
        this.rows = Math.floor(maxHeight / this.blockSize)
      }
      canvasHeight = this.rows * this.blockSize + this.blockSpace
    } else {
      this.rows = this.cols
      canvasHeight = canvasWidth
    }
    this.pixRatio = pixRatio
    this.canvas.width = canvasWidth
    this.canvas.height = canvasHeight
  }

  initBlocks(rows, cols) {
    const blocks = []
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        blocks.push(new Block({ row, col }))
      }
    }
    return blocks
  }

  drawBlacks() {
    this.blocks.forEach(block => {
      block.draw({
        context: this.context,
        size: this.blockSize,
        space: this.blockSpace
      })
    })
  }

  reDraw() {
    let { width, height } = this.canvas
    this.context.clearRect(0, 0, +width, +height)
    this.drawBlacks()
  }

  getCurBlock(event) {
    let ex = (event.offsetX || event.pageX) * this.pixRatio
    let ey = (event.offsetY || event.pageY) * this.pixRatio
    let curCol = Math.floor(ex / this.blockSize)
    let curRow = Math.floor(ey / this.blockSize)
    for (let i = 0, len = this.blocks.length; i < len; i++) {
      let _ = this.blocks[i]
      if (_.row === curRow && _.col === curCol) return _
    }
  }

  addListener() {
    this.canvas.addEventListener('click', this.onClick.bind(this), false)
    this.canvas.addEventListener('contextmenu', this.onContextmenu.bind(this), false)
  }

  onClick(event) {
    if (this.isEnd) return
    let curBlock = this.getCurBlock(event)
    if (!curBlock || curBlock.isOpened || curBlock.isFlag) return
    if (this.isFirstClick) {
      this.updateMineMap(curBlock)
      this.isFirstClick = false
    }
    curBlock.isOpened = true
    this.reDraw()
    if (!curBlock.num) {
      this.openZeroBlocks(curBlock)
    } else if (curBlock.num === 9) {
      this.bombAndOver()
    }
    if (this.checkDone()) {
      alert('恭喜！你完成了！')
    }
  }

  onContextmenu(event) {
    event.preventDefault()
    if (this.isEnd) return
    let curBlock = this.getCurBlock(event)
    if (!curBlock || curBlock.isOpened) return
    curBlock.isFlag = !curBlock.isFlag
    this.reDraw()
  }

  updateMineMap(block) {
    let numArray = [
      ...Array(this.mineCount).fill(9), 
      ...Array(this.blocks.length - this.mineCount).fill(0)
    ]
    numArray.sort(() => Math.random() - .5)
    let curIndex = this.blocks.indexOf(block)
    if (numArray[curIndex] === 9) {
      for (let i = 0, len = numArray.length; i < len; i++) {
        if (!numArray[i]) {
          numArray[curIndex] = 0
          numArray[i] = 9
          break
        }
      }
    }
    numArray.forEach((num, index) => this.blocks[index].num = num)
    this.updateBlocksNum()
  }

  getRoundBlocks(i) {
    let tl = this.blocks[i - this.cols - 1]
    let tm = this.blocks[i - this.cols]
    let tr = this.blocks[i - this.cols + 1]
    let r = this.blocks[i + 1]
    let br = this.blocks[i + this.cols + 1]
    let bm = this.blocks[i + this.cols]
    let bl = this.blocks[i + this.cols - 1]
    let l = this.blocks[i - 1]
    let arr = [tl, tm, tr, r, br, bm, bl, l]
    if (i % this.cols === 0) {
      arr = [tm, tr, r, br, bm]
    } else if ((i + 1) % this.cols === 0) {
      arr = [tl, tm, bm, bl, l]
    }
    return arr.filter(_ => _)
  }

  getTRBLBlocks(i) {
    let t = this.blocks[i - this.cols]
    let r = this.blocks[i + 1]
    let b = this.blocks[i + this.cols]
    let l = this.blocks[i - 1]
    let arr = [t, r, b, l]
    if (i % this.cols === 0) {
      arr = [t, r, b]
    } else if ((i + 1) % this.cols === 0) {
      arr = [t, b, l]
    }
    return arr.filter(_ => _)
  }

  updateBlocksNum() {
    for (let i = 0, len = this.blocks.length; i < len; i++) {
      let block = this.blocks[i]
      if (block.num === 9) continue
      block.num = this.getRoundBlocks(i).filter(_ => _.num === 9).length
    }
  }

  bombAndOver() {
    let { context, blockSize: size, blockSpace: space } = this
    this.blocks.forEach(_ => {
      if (_.num === 9) {
        _.isOpened = true
        _.draw({ context, size, space })
      }
    })
    this.isEnd = true
  }

  openZeroBlocks(block) {
    let checkedBlocks = [], noCheckBlocks = [block]
    while (noCheckBlocks.length) {
      let b = noCheckBlocks.pop()
      if (checkedBlocks.indexOf(b) === -1) checkedBlocks.push(b)
      let index = this.blocks.indexOf(b)
      let roundBlocks = this.getTRBLBlocks(index)
      for (let i = 0, len = roundBlocks.length; i < len; i++) {
        let _ = roundBlocks[i]
        if (!_.num && !_.isFlag && checkedBlocks.indexOf(_) === -1) {
          noCheckBlocks.push(_)
        }
      }
    }
    checkedBlocks.forEach(_ => _.isOpened = true)
    this.reDraw()
  }

  checkDone() {
    for (let i = 0, len = this.blocks.length; i < len; i++) {
      let _ = this.blocks[i]
      if (_.num !== 9 && !_.isOpened) return false
    }
    return true
  }
}

// 游戏类
class Game {
  loadIcons(icons) {
    if (this.isIconsLoaded) return Promise.resolve()
    const loadImage = key => {
      return new Promise(resolve => {
        const image = new Image()
        image.onload = () => {
          image.onload = null
          resolve({ [key]: image })
        }
        image.src = icons[key]
      })
    }
    return Promise.all(Object.keys(icons).map(_ => loadImage(_))).then(values => {
      this.isIconsLoaded = true
      values.forEach(item => gameIcons = { ...gameIcons, ...item })
    })
  }
  
  start() {
    this.loadIcons(iconSources).then(() => {
      const panel = new Panel({ cols: 9, mineCount: 10 })
    })
  }
}

new Game().start()