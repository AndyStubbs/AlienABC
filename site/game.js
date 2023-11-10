"use strict";

( function () {

	const game = {};
	const MAX_VELOCITY_Y_FOR_GROUNDED = 1.8;
	const JUMP_FORCE = -0.25;
	const DEBUG = true;

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

		game.lastBodyId = 0;
		game.bodies = [];
		game.actorsMap = {};

		// Create the level container.
		if( game.container ) {
			game.app.stage.removeChild( game.container );
			game.container.destroy();
		}
		game.container = new PIXI.Container();
		g.app.stage.addChild( game.container );

		// Create the physics world.
		game.engine = Matter.Engine.create();

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

		// Set the intial camera position.
		const pos = g.app.stage.toLocal(
			new PIXI.Point( game.player.container.x, game.player.container.y )
		);
		game.container.x = ( -pos.x / ( 1 / g.app.stage.scale.x ) ) +
			( g.app.screen.width / g.app.stage.scale.x ) / 2;
		game.container.y = ( -pos.y / ( 1 / g.app.stage.scale.y ) ) +
			( g.app.screen.height / g.app.stage.scale.y ) / 2;

		// Add the physics bodies to the world.
		Matter.Composite.add( game.engine.world, game.bodies );

		// Run the physics simulation.
		game.runner = Matter.Runner.create();
		Matter.Runner.run( game.runner, game.engine );

		// Run the graphics step.
		g.app.ticker.add( step );

		// Setup the collider event
		Matter.Events.on( game.engine, "collisionStart", collisionCheck );

		// Setup the input handlers.
		setupInputs();
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

		// Get the position of the player sprite in the game container.
		const pos = game.container.toLocal( new PIXI.Point( obj.x, obj.y ) );

		// Create the player container.
		player.container = new PIXI.Container();
		player.container.x = pos.x;
		player.container.y = pos.y;
		player.container.scale.x = 1 / g.app.stage.scale.x;
		player.container.scale.y = 1 / g.app.stage.scale.y;
		container.addChild( player.container );

		// Create the player sprite
		player.sprite = new PIXI.Sprite( g.spritesheet.textures[ "p1_front.png" ] );
		player.sprite.anchor.set( 0.5, 0.5 );
		player.container.addChild( player.sprite );

		// Create the jump sprite.
		player.jumpSprite = new PIXI.Sprite( g.spritesheet.textures[ "p1_jump.png" ] );
		player.jumpSprite.anchor.set( 0.5, 0.5 );
		player.jumpSprite.visible = false;
		player.container.addChild( player.jumpSprite );

		// Create the player walking animation.
		const frames = [];
		for( let i = 1; i <= 11; i++ ) {
			const id = i < 10 ? "0" + i : i;
			frames.push( g.spritesheet.textures[ "p1_walk/p1_walk" + id + ".png" ] );
		}
		player.walkAnimation = new PIXI.AnimatedSprite( frames );
		player.walkAnimation.anchor.set( 0.5, 0.5 );
		player.walkAnimation.animationSpeed = 0.3;
		player.walkAnimation.visible = false;
		player.container.addChild( player.walkAnimation );

		// Create the player physics body
		const width = player.sprite.width / player.sprite.scale.x;
		const height = player.sprite.height / player.sprite.scale.y;
		player.body = Matter.Bodies.rectangle(
			obj.x,
			obj.y,
			width,
			height,
			{
				"inertia": Infinity,
				"customData": { "type": "actor" }
			}
		);
		game.lastBodyId++;
		game.actorsMap[ player.body.id ] = player;
		game.bodies.push( player.body );

		// Assign the player to the game object.
		game.player = player;

		if( DEBUG ) {
			// Add a debug graphics object to the sprite.
			player.debug = new PIXI.Graphics();
			game.container.addChild( player.debug );
		}
	}

	function createGround( obj ) {
		const body = Matter.Bodies.rectangle(
			obj.x + obj.width / 2,
			obj.y + obj.height / 2,
			obj.width,
			obj.height,
			{
				"isStatic": true,
				"customData": {
					"type": "ground"
				}
			}
		);
		body.friction = 0;
		game.bodies.push( body );
	}

	function step() {
		moveCamera();
		updatePosition( game.player );
		applyControls( game.player );
	}

	function updatePosition( actor ) {
		const body = actor.body;
		const pos = actor.container.parent.toLocal(
			new PIXI.Point( body.position.x, body.position.y )
		);
		actor.container.x = pos.x + game.container.x;
		actor.container.y = pos.y + game.container.y;
		//actor.container.x = body.position.x;
		//actor.container.y = body.position.y;

		// Update the sprite rotation.
		actor.container.rotation = body.angle;

		// Draw a wire frame around the sprite using the body vertices.
		if( actor.debug ) {
			actor.debug.clear();
			if( actor.isGrounded ) {
				actor.debug.lineStyle( 1, "#0000ff" );
			} else {
				actor.debug.lineStyle( 1, "#00ff00" );
			}
			actor.debug.beginFill( "#000000", 0 );
			let pos = game.container.toLocal(
				new PIXI.Point(
					body.vertices[ 0 ].x,
					body.vertices[ 0 ].y
				)
			);
			actor.debug.moveTo( pos.x + game.container.x, pos.y + game.container.y );
			for( let i = 1; i < body.vertices.length; i++ ) {
				pos = game.container.toLocal(
					new PIXI.Point( body.vertices[ i ].x, body.vertices[ i ].y )
				);
				actor.debug.lineTo( pos.x + game.container.x, pos.y + game.container.y );
			}
			pos = game.container.toLocal(
				new PIXI.Point( body.vertices[ 0 ].x, body.vertices[ 0 ].y )
			);
			actor.debug.lineTo( pos.x + game.container.x, pos.y + game.container.y );
			actor.debug.endFill();
		}
	}

	function applyControls( player ) {

		// Apply player movement for platformer controls.
		const keys = game.keys;
		const speed = 5;

		// Apply movement.
		let isWalking = false;
		if( keys.ArrowLeft ) {
			isWalking = true;

			// Set the sprite orientation.
			player.walkAnimation.scale.x = -1;
			player.sprite.scale.x = -1;
			player.jumpSprite.scale.x = -1;

			// Apply the movement.
			Matter.Body.translate( player.body, { "x": -speed, "y": 0 } );

		} else if( keys.ArrowRight ) {

			isWalking = true;

			// Set the sprite orientation.
			player.walkAnimation.scale.x = 1;
			player.sprite.scale.x = 1;
			player.jumpSprite.scale.x = 1;

			// Apply the movement.
			Matter.Body.translate( player.body, { "x": speed, "y": 0 } );

		} else {
			player.walkAnimation.visible = false;
			player.walkAnimation.gotoAndStop( 0 );
			player.sprite.visible = true;
		}

		if( isWalking && player.isGrounded ) {
			player.walkAnimation.visible = true;
			player.walkAnimation.play();
			player.sprite.visible = false;
		}

		// Check if falling, allow for a little bit of leeway.
		if( player.isGrounded && player.body.velocity.y > MAX_VELOCITY_Y_FOR_GROUNDED ) {
			player.isGrounded = false;
		}

		// Apply Jumping
		if( keys.ArrowUp ) {
			if( player.isGrounded ) {
				Matter.Body.applyForce(
					player.body, player.body.position, { "x": 0, "y": JUMP_FORCE }
				);
				player.isGrounded = false;
			}
		}

		// Update the jump sprite visibility.
		if( player.isGrounded ) {
			player.jumpSprite.visible = false;
		} else {
			player.jumpSprite.visible = true;
			player.sprite.visible = false;
			player.walkAnimation.visible = false;
			player.walkAnimation.gotoAndStop( 0 );
		}
	}

	function moveCamera() {
		const player = game.player;
		const pos = g.app.stage.toLocal(
			new PIXI.Point( player.container.x, player.container.y )
		);

		let targetX = ( -pos.x / ( 1 / g.app.stage.scale.x ) ) +
			( g.app.screen.width / g.app.stage.scale.x ) / 2;
		let targetY = ( -pos.y / ( 1 / g.app.stage.scale.y ) ) +
			( g.app.screen.height / g.app.stage.scale.y ) / 2;

		// Below code is for a smooth camera follow. -- Not working well.
		/*
		if( player.sprite.scale.x > 0 ) {
			targetX -= ( g.app.screen.width / 15 );
		} else {
			targetX += ( g.app.screen.width / 15 );
		}
		const dx = targetX - game.container.x;
		const dy = targetY - game.container.y;
		const dist = Math.sqrt( dx * dx + dy * dy );
		const move = Math.sqrt( g.app.screen.width * g.app.screen.width + g.app.screen.height * g.app.screen.height ) / 300;
		if( Math.abs( dist ) > move ) {
			targetX = game.container.x + dx / dist * move;
			targetY = game.container.y + dy / dist * move;
		}*/
		game.container.x = targetX;
		game.container.y = targetY;
	}

	function setupInputs() {
		const keys = {};
		document.addEventListener( "keydown", keydown );
		document.addEventListener( "keyup", keyup );
		game.keys = keys;
	}

	function clearInputs() {
		document.removeEventListener( "keydown", keydown );
		document.removeEventListener( "keyup", keyup );
		game.keys = {};
	}

	function keydown( e ) {
		game.keys[ e.key ] = true;
	}

	function keyup( e ) {
		game.keys[ e.key ] = false;
	}

	function collisionCheck( collisions ) {
		const pairs = collisions.source.pairs.list;
		for( let i = 0; i < pairs.length; i++ ) {
			const pair = pairs[ i ];
			const a = pair.bodyA.customData;
			const b = pair.bodyB.customData;
			const penetration = pair.collision.penetration;
			if( a.type === "actor" && b.type === "ground" && penetration.y < 0 ) {
				game.actorsMap[ pair.bodyA.id ].isGrounded = true;
			} else if ( a.type === "ground" && b.type === "actor" && penetration.y > 0) {
				game.actorsMap[ pair.bodyB.id ].isGrounded = true;
			}
		}
	}

} )();



