"use strict";

( function () {

	const game = {};

	g.loadLevel = async function ( name ) {
		if( !game.tiles ) {
			loadTiles();
		}
		const response = await fetch( "assets/tiled/alien-" + name + ".json" );
		const json = await response.json();
		game.level = json;
	};

	g.startLevel = function () {
		if( !game.level || !game.tiles ) {
			setTimeout( g.startLevel, 100 );
			return;
		}

		// Create the level container.
		if( game.container ) {
			game.app.stage.removeChild( game.container );
			game.container.destroy();
		}
		game.container = new PIXI.Container();
		g.app.stage.addChild( game.container );

		// Create the physics world.
		game.engine = Matter.Engine.create();
		game.bodies = [];

		// Create the level objects.
		game.level.layers.forEach( layer => {
			const container = new PIXI.Container();
			game.container.addChild( container );
			if( layer.type === "tilelayer" ) {
				createTiles( layer, container );
			} else if( layer.type === "objectgroup" ) {
				createObjects( layer, container );
			}
		} );

		// Add the physics bodies to the world.
		Matter.Composite.add( game.engine.world, game.bodies );

		// Run the physics simulation.
		game.runner = Matter.Runner.create();
		Matter.Runner.run( game.runner, game.engine );

		// Run the graphics step.
		g.app.ticker.add( graphicsStep );
	};

	async function loadTiles() {
		const response = await fetch( "assets/tiled/alien-tiles.json" );
		const json = await response.json();

		game.tiles = {};
		json.tiles.forEach( ( tile ) => {
			const name = tile.image.split( "/" ).pop();
			game.tiles[ tile.id + 1 ] = g.spritesheet.textures[ name ];
		} );
	}

	function createTiles( layer, container ) {
		for( let i = 0; i < layer.data.length; i++ ) {
			const tileId = layer.data[ i ];
			if( tileId && tileId !== 0 ) {
				const tile = new PIXI.Sprite( game.tiles[ tileId ] );
				const pos = game.container.toLocal( new PIXI.Point( 
					( i % layer.width ) * game.level.tilewidth,
					Math.floor( i / layer.width ) * game.level.tileheight
				) );
				tile.x = pos.x;
				tile.y = pos.y;
				tile.scale.x = 1 / g.app.stage.scale.x;
				tile.scale.y = 1 / g.app.stage.scale.y;
				container.addChild( tile );
			}
		}
	}

	function createObjects( layer, container ) {
		layer.objects.forEach( obj => {
			if( obj.name === "Start" ) {
				createPlayer( obj, container );
			} else if( obj.type === "ground" ) {
				createGround( obj );
			}
		} );
	}

	function createPlayer( obj, container ) {
		const player = {};

		// Adjust the player position to account for the player sprite's height.
		obj.y -= 500;

		// Create the player sprite
		player.sprite = new PIXI.Sprite( g.spritesheet.textures[ "p1_front.png" ] );
		const pos = game.container.toLocal( new PIXI.Point( obj.x, obj.y ) );
		player.sprite.x = pos.x;
		player.sprite.y = pos.y;
		player.sprite.scale.x = 1 / g.app.stage.scale.x;
		player.sprite.scale.y = 1 / g.app.stage.scale.y;
		container.addChild( player.sprite );

		// Create the player physics body
		const width = player.sprite.width / player.sprite.scale.x;
		const height = player.sprite.height / player.sprite.scale.y;
		player.body = Matter.Bodies.rectangle( obj.x, obj.y, width, height );
		game.bodies.push( player.body );

		game.player = player;
	}

	function createGround( obj ) {
		const body = Matter.Bodies.rectangle(
			obj.x + obj.width / 2,
			obj.y + obj.height / 2,
			obj.width,
			obj.height,
			{ "isStatic": true }
		);
		game.bodies.push( body );
	}

	function graphicsStep() {
		updateSpritePosition( game.player.sprite, game.player.body );
	}

	function physicsStep() {
		game.world.step();
		console.log( Date.now() );
	}

	function updateSpritePosition( sprite, body ) {
		const pos = game.container.toLocal(
			new PIXI.Point( body.position.x, body.position.y - 46 )
		);
		sprite.x = pos.x;
		sprite.y = pos.y;
	}

} )();



