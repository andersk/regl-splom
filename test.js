'use strict'

const regl = require('regl')({ extensions: 'oes_element_index_uint' })
const createSettings = require('../settings-panel')
const createMatrix = require('./')
const panzoom = require('pan-zoom')
const random = require('gauss-random')
const alpha = require('color-alpha')
const palettes = require('nice-color-palettes')
const palette = palettes[Math.floor(Math.random() * palettes.length)]
const fps = require('fps-indicator')({position: 'bottom-right', color: 'black'})


// create splom instance
let splom = createMatrix(regl)


// data for the splom
let passes = []

// create settings panel & bind
let settings = createSettings({
	traces: { value: 2, min: 1, max: 10, type: 'range' },
	variables: { value: 20, min: 1, max: 100, type: 'range' },
	points: { value: 1e3, min: 1, max: 1e4, type: 'range' },
	// snap: { value: false }
}, {
	position: 'center bottom',
	background: 'transparent',
	orientation: 'horizontal'
})

settings.on('change', update)


// regenerate the data based on options
function update () {
	console.time('generate')
	let {traces, variables, points} = settings.values
	traces = parseInt(traces)
	variables = parseInt(variables)
	points = parseInt(points)

	if (traces < passes.length) {
		for (let i = traces; i < passes.length; i++) {
			passes[i] = null
		}
	}

	for (let i = 0; i < traces; i++) {
		let pass = (passes[i] || (passes[i] = {
			color: alpha(palette[i % palette.length], Math.random() * .5 + .25),
			size: 3,
			range: [],
			domain: [],
			viewport: [0,0, regl._gl.drawingBufferWidth, regl._gl.drawingBufferHeight]
		}))

		if (!pass.data) pass.data = []
		if (pass.data.length > variables) pass.data.length = variables

		for (let col = 0; col < variables; col++) {
			if (!pass.data[col]) {
				pass.data[col] = []
				pass.data[col].mean = Math.random()
				pass.data[col].sdev = Math.random()
				pass.range[col] = passes[i-1] && passes[i-1].range[col] || [-5,-5,5,5]
				pass.domain[col] = passes[i-1] && passes[i-1].domain[col] || [col/variables,col/variables,(col+1)/variables,(col+1)/variables]
			}
			let colData = pass.data[col]
			let {mean, sdev} = colData
			if (colData.length > points) colData.length = points
			for (let i = colData.length; i < points; i++) {
				colData[i] = random() * sdev + mean
			}
		}
	}
	console.timeEnd('generate')

	console.time('update')
	splom.update(...passes)
	console.timeEnd('update')

	console.time('draw')
	splom.draw()
	console.timeEnd('draw')
}

update()


panzoom(splom.canvas, e => {
	let cnv = e.target

	let w = cnv.offsetWidth
	let h = cnv.offsetHeight

	let n = settings.values.variables

	let rx = e.x0 / w
	let ry = e.y0 / h

	let i = Math.floor(rx * n)
	let j = Math.floor((1 - ry) * n)

	rx = .5, ry = .5

	let rangePasses = passes.map(pass => {
		let ranges = pass.range

		let xrange = ranges[i][2] - ranges[i][0],
			yrange = ranges[j][3] - ranges[j][1]

		if (e.dz) {
			let dz = e.dz / w
			ranges[i][0] -= rx * xrange * dz
			ranges[i][2] += (1 - rx) * xrange * dz

			ranges[j][1] -= (1 - ry) * yrange * dz
			ranges[j][3] += ry * yrange * dz
		}

		ranges[i][0] -= xrange * n * .5 * e.dx / w
		ranges[i][2] -= xrange * n * .5 * e.dx / w
		ranges[j][1] += yrange * n * .5 * e.dy / h
		ranges[j][3] += yrange * n * .5 * e.dy / h

		return { ranges }
	})

	console.time('update')
	splom.update(...rangePasses)
	console.timeEnd('update')

	console.time('draw')
	splom.draw()
	console.timeEnd('draw')
})

