"use strict";

// alien.js

const g = {};

( function () {

	window.addEventListener( "DOMContentLoaded", init );

	function init() {

		g.scale = { "aspect": 4 / 3, "x": 1, "y": 1, "width": 800, "height": 600 };

		// Create the PIXI application.
		g.app = new PIXI.Application( {
			"backgroundColor": "#5E3F6B",
			"resizeTo": window
		} );
		document.body.appendChild( g.app.view );

		// Load the assets
		( async () => {
			const backgroundPromise = PIXI.Assets.load( "assets/backgrounds.json" );
			const spritesheetPromise = PIXI.Assets.load( "assets/spritesheet.json" );
			g.backgrounds = await backgroundPromise;

			// Create the background.
			g.background = new PIXI.TilingSprite(
				g.backgrounds.textures[ "bg_purple.png" ], g.app.screen.width, g.app.screen.height
			);
			g.app.stage.addChild( g.background );

			// Resize the background.
			window.addEventListener( "resize", resize );
			resize();

			// Create the spritesheet.
			g.spritesheet = await spritesheetPromise;
		} )();
	}

	function resize() {
		if ( window.innerWidth / window.innerHeight >= g.scale.aspect ) {
			g.scale.x = window.innerHeight * g.scale.aspect / g.scale.width;
			g.scale.y = window.innerHeight / g.scale.height;
		} else {
			g.scale.x = window.innerWidth / g.scale.width;
			g.scale.y = window.innerWidth / g.scale.aspect / g.scale.height;
		}
		g.app.stage.scale.x = g.scale.x;
		g.app.stage.scale.y = g.scale.y;
		g.background.width = g.app.screen.width / g.scale.x;
		g.background.height = g.app.screen.height / g.scale.y;
		g.app.renderer.resize( window.innerWidth, window.innerHeight );
	}

} )();

/*
// Run the simulation.
run_simulation();

// OR using the await syntax:
async function run_simulation() {
	//const RAPIER = await import('https://cdn.skypack.dev/@dimforge/rapier2d-compat');
	//await RAPIER.init();
	// Run the simulation.
	// Use the RAPIER module here.
	let gravity = { x: 0.0, y: -9.81 };
	let world = new RAPIER.World(gravity);

	// Create the ground
	let groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 0.1);
	world.createCollider(groundColliderDesc);

	// Create a dynamic rigid-body.
	let rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
			.setTranslation(0.0, 1.0);
	let rigidBody = world.createRigidBody(rigidBodyDesc);

	// Create a cuboid collider attached to the dynamic rigidBody.
	let colliderDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5);
	let collider = world.createCollider(colliderDesc, rigidBody);

	// Game loop. Replace by your own game loop system.
	let gameLoop = () => {
	// Ste the simulation forward.  
	world.step();

	// Get and print the rigid-body's position.
	let position = rigidBody.translation();
	console.log("Rigid-body position: ", position.x, position.y);

	setTimeout(gameLoop, 16);
	};

	gameLoop();
}
*/