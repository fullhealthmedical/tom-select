var fs = require('fs');
var path = require('path');
var process = require('process');

module.exports = function(grunt) {
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-connect');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-replace');
	grunt.loadNpmTasks('@lodder/grunt-postcss');

	const sass = require('sass');
	

	require('load-grunt-tasks')(grunt); //sass

	grunt.registerTask('default', [
		'build'
	]);


	grunt.registerTask('build', [
		'clean:library',

		'shell:buildjs',

		'copy:scss',
		'copy:scss_plugins',
		'sass:build',
		'postcss:prefix',
		'postcss:min',
		'replace:css_post',
		'replace:scss_plugin_paths'
	]);

	grunt.registerTask('serve', [
		'build',
		'builddocs',
		'connect',
		'check_doc_links',
		'watch'
	])

	grunt.registerTask('builddocs',[
		'clean:builddocs',
		'shell:builddocs',
		'shell:rollupdocs',
		'replace:builddocs',
		'sass:builddocs',
		'postcss:builddocs',
	]);



	/**
	 * Check generated docs for broken links
	 * https://www.npmjs.com/package/broken-link-checker
	 */
	grunt.registerTask('check_doc_links','',function(){
		var done = this.async();
		const {SiteChecker} = require('broken-link-checker');
		const options = {
			excludeExternalLinks: true,
			cacheMaxAge:60,
		};

		var urls_checked	= 0;
		var links_checked	= 0;
		var failures		= 0;


		const handlers = {
			error:function(error){
				failures++;
				console.log('error',error);
			},
			page:function(error, page_url, customData){
				if( error ){
					failures++;
					console.log('error!',page_url);
				}

				urls_checked++;
			},
			junk:function( result, data ){

				links_checked++;
				if( result.broken ){
					failures++;
					console.log('broken junk found',result);
				}
			},
			link:function(link){
				if( link.broken ){
					failures++;
					console.log('broken link',link);
				}
			},
			end:function(){
				console.log('urls checked',urls_checked);
				console.log('links checked',links_checked);
				console.log('failures',failures);

				done(failures==0);
			}
		};

		const checker = new SiteChecker(options,handlers)
		checker.enqueue('http://localhost:8000/', {});
	});


	// build tom-select.custom.js
	var plugin_arg			= grunt.option('plugins');
	var custom_file			= path.resolve( process.cwd(),'./src/tom-select.custom.ts');
	var custom_content		= ['/* this file is generated by grunt when calling `npm run build -- --plugins=<plugins> */','import TomSelect from "./tom-select";'];

	if( fs.existsSync(custom_file) ){
		fs.unlink(custom_file,err => {
			if (err) {
				console.error(err)
			}
		});
	}

	if( plugin_arg ){
		var plugin_args	= plugin_arg.split(/\s*,\s*/);

		plugin_args.map((plugin_name) => {
			custom_content.push(`import ${plugin_name} from './plugins/${plugin_name}/plugin.js';`);
		});
		plugin_args.map((plugin_name) => {
			custom_content.push(`TomSelect.define('${plugin_name}', ${plugin_name});`);
		});
		custom_content.push('export default TomSelect;');

		fs.writeFile(custom_file, custom_content.join("\n"),err => {
			if (err) {
				console.error(err)
			}
		});
	}



	// find all plugin scss files
	var scss_plugin_files	= [];
	var matched_files = grunt.file.expand(['src/plugins/*/plugin.scss']);
	for (var i = 0, n = matched_files.length; i < n; i++) {
		var plugin_name = matched_files[i].match(/src\/plugins\/(.+?)\//)[1];
		scss_plugin_files.push({src: matched_files[i], dest: 'build/scss/plugins/' + plugin_name + '.scss'});
	}



	// bootstrap browserlist https://github.com/twbs/bootstrap/blob/main/.browserslistrc
	var autoprefixer = require('autoprefixer')();


	var version_replace_options = {
		prefix: '//@@',
		variables: {
			'version': '<%= pkg.version %>',
		}
	};

	var scss_plugin_path_replace_options = {
		patterns: [{
			match: /\.\.\/plugins\/(.+?)\/plugin\.scss/g,
			replacement: './plugins/$1.scss'
		}],
		usePrefix: false
	};


	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),

		// delete old build files
		clean: {
			library: ['build/scss/*','build/js/*','build/esm/*','build/css/*','build/cjs/*'],
			builddocs: ['build-docs/*']
		},

		// copy scss files to build folder
		copy: {
			scss:{
				files: [{
					'build/scss/tom-select.scss': ['src/scss/tom-select.scss'],
					'build/scss/tom-select.default.scss': ['src/scss/tom-select.default.scss'],
					'build/scss/tom-select.fhweb.scss': ['src/scss/tom-select.fhweb.scss'],
					'build/scss/tom-select.bootstrap4.scss': ['src/scss/tom-select.bootstrap4.scss'],
					'build/scss/tom-select.bootstrap5.scss': ['src/scss/tom-select.bootstrap5.scss'],
					'build/scss/_dropdown.scss': ['src/scss/_dropdown.scss'],
					'build/scss/_items.scss': ['src/scss/_items.scss'],
				}]
			},
			scss_plugins:{
				files: scss_plugin_files
			},
		},

		// replace //@@version with current package version
		replace: {
			// add version to css & scss headers
			css_post: {
				options: version_replace_options,
				files: [
					{expand: true, flatten: false, src: ['build/css/*.css'], dest: ''},
					{expand: true, flatten: false, src: ['build/scss/*.scss'], dest: ''},
				]
			},
			builddocs:{
				options: version_replace_options,
				files:[
					{src:['build-docs/js/index.bundle.js'],dest:'build-docs/js/index.bundle.js'},
					{src:['build-docs/index.html'],dest:'build-docs/index.html'}
				]
			},
			scss_plugin_paths: {
				options: scss_plugin_path_replace_options,
				files: [{expand: true, flatten: false, src: ['build/scss/tom-select.scss'], dest: ''}]
			},
		},


		// compile css from scss
		sass: {
			options:{
				implementation: sass,
				style:'expanded',
			},
			build: {
				files: [{
					'build/css/tom-select.css': ['src/scss/tom-select.scss'],
					'build/css/tom-select.default.css': ['src/scss/tom-select.default.scss'],
					'build/css/tom-select.fhweb.css': ['src/scss/tom-select.fhweb.scss'],
					'build/css/tom-select.bootstrap4.css': ['src/scss/-tom-select.bootstrap4.scss'],
					'build/css/tom-select.bootstrap5.css': ['src/scss/-tom-select.bootstrap5.scss'],
				}]
			},
			builddocs: {
				files: [{
					expand: true,
					flatten: true,
					ext: '.css',
					src: ['doc_src/css/*.scss'],
					dest: 'build-docs/css'
				}],
			}
		},

		// autoprefix && cssnanao
		postcss: {
			prefix: {
				options:{
					map: {
						inline: false, // save all sourcemaps as separate files...
					},
					processors: [
						//require('pixrem')(), // add fallbacks for rem units
						autoprefixer,
					]
				},
				files: [{expand: true, flatten: false, src: ['build/css/*.css'], dest: ''}],
			},
			min: {
				options: {
					map: {
						inline: false, // save all sourcemaps as separate files...
					},
					processors: [
						require('cssnano')() // minify the result
					]
				},
				files: [{
					'build/css/tom-select.min.css': ['build/css/tom-select.css'],
					'build/css/tom-select.default.min.css': ['build/css/tom-select.default.css'],
					'build/css/tom-select.fhweb.min.css': ['build/css/tom-select.fhweb.css'],
					'../fhweb/vendor/assets/stylesheets/tom-select.fhweb.min.css': ['build/css/tom-select.fhweb.css'],
					'build/css/tom-select.bootstrap4.min.css': ['build/css/tom-select.bootstrap4.css'],
					'build/css/tom-select.bootstrap5.min.css': ['build/css/tom-select.bootstrap5.css'],
				}]
			},
			builddocs:{
				options:{
					map: {
						inline: false, // save all sourcemaps as separate files...
					},
					processors: [
						autoprefixer,
						require('cssnano')() // minify the result
					]
				},
				files: [{
					expand: true,
					flatten: true,
					src: ['build-docs/css/*.css'],
					dest: 'build-docs/css'
				}],
			},
		},

		// run server at http://localhost:8000 to view documentation and run examples
		connect: {
			server:{
				options: {
					base: 'build-docs',
				}
			}
		},

		// generate /build-docs
		shell: {
			builddocs: {
				command: 'npx @11ty/eleventy --config=.config/eleventy.js',
			},
			rollupdocs: {
				command: 'npx rollup -c .config/rollup.docs.mjs',
			},
			buildjs: {
				command: 'npx rollup -c .config/rollup.config.mjs',
			},
		},

		watch: {
			// changes to files in /doc_src: rebuild all of documentation
			docs:{
				files:[
					'doc_src/**',
				],
				tasks:[
					'builddocs',
					'check_doc_links',
				]
			},
			// changes to files in /src: rebuild library and copy to docs
			src:{
				files: [
					'src/**',
				],
				tasks: [
					'build',
					'shell:builddocs',
				]
			}
		}
	});
};
